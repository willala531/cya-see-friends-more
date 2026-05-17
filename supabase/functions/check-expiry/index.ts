// check-expiry — Supabase Edge Function (scheduled, runs hourly)
// Handles seven time-based jobs:
//   1. Resolve expired votes (vote_expires_at < NOW, vote_options != null)
//   2. Cancel expired RSVPs (rsvp_expires_at < NOW, status = pending)
//   3. Send 24-hour reminder (rsvp_expires_at within next 24h, reminder not sent)
//   4. Expire stale group invites
//   5. Stamp groups.last_hangout_at for confirmed hangouts that have passed
//   6. Mark past confirmed hangouts as "completed" (runs after Job 5)
//   7. Unpause suggestions whose members' schedules have cleared

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SELF_URL = Deno.env.get("SUPABASE_URL")!.replace(
  "https://",
  "https://",
); // Edge Function self-invoke URL base

async function invokeDecision(body: Record<string, unknown>) {
  // Call the process-hangout-decision function via supabase.functions.invoke
  // We do this via fetch since we're already inside an Edge Function
  const projectRef = Deno.env.get("SUPABASE_URL")!
    .replace("https://", "")
    .split(".")[0];
  const fnUrl = `https://${projectRef}.supabase.co/functions/v1/process-hangout-decision`;

  await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(body),
  });
}

async function getGroupMembers(groupId: string): Promise<string[]> {
  const { data } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}

async function createNotifications(
  userIds: string[],
  groupId: string,
  message: string,
) {
  if (userIds.length === 0) return;
  await supabase.from("notifications").insert(
    userIds.map((user_id) => ({ user_id, group_id: groupId, message })),
  );
}

Deno.serve(async (req) => {
  // Allow both scheduled invocations (no auth) and manual calls (service role)
  const now = new Date().toISOString();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // ── Job 1: resolve expired votes ──────────────────────────────────────────
  const { data: expiredVotes } = await supabase
    .from("hangout_suggestions")
    .select("id")
    .not("vote_options", "is", null)
    .lt("vote_expires_at", now)
    .eq("status", "pending");

  for (const row of expiredVotes ?? []) {
    await invokeDecision({ type: "vote_resolved", hangoutId: row.id });
  }

  // ── Job 2: cancel expired RSVPs ───────────────────────────────────────────
  const { data: expiredRsvps } = await supabase
    .from("hangout_suggestions")
    .select("id, group_id, suggested_activity")
    .eq("status", "pending")
    .not("rsvp_expires_at", "is", null)
    .lt("rsvp_expires_at", now);

  for (const row of expiredRsvps ?? []) {
    await invokeDecision({ type: "cancel", hangoutId: row.id });
  }

  // ── Job 3: send 24-hour reminder ──────────────────────────────────────────
  const { data: expiringSoon } = await supabase
    .from("hangout_suggestions")
    .select("id, group_id, suggested_activity, rsvp_expires_at")
    .eq("status", "pending")
    .eq("reminder_sent", false)
    .not("rsvp_expires_at", "is", null)
    .gt("rsvp_expires_at", now)
    .lt("rsvp_expires_at", in24h);

  for (const row of expiringSoon ?? []) {
    const memberIds = await getGroupMembers(row.group_id);
    const msg = `⏰ Is this thing happening or not? RSVPs for ${row.suggested_activity ?? "your hangout"} expire in 24 hours — respond now!`;
    await createNotifications(memberIds, row.group_id, msg);

    await supabase
      .from("hangout_suggestions")
      .update({ reminder_sent: true })
      .eq("id", row.id);
  }

  // ── Job 4: expire stale group invites ──────────────────────────────────────
  const { data: expiredInvites } = await supabase
    .from("group_invites")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", now)
    .select("id");

  // ── Job 5: stamp groups.last_hangout_at for confirmed hangouts that have passed ─
  // For every confirmed hangout whose start_time is in the past, update the
  // group's last_hangout_at if this hangout's start_time is more recent than the
  // current value. This drives the per-group 7-day cooldown (Rule 1a).
  const { data: pastConfirmed } = await supabase
    .from("hangout_suggestions")
    .select("id, group_id, start_time")
    .eq("status", "confirmed")
    .lt("start_time", now);

  let stampedGroups = 0;
  for (const row of pastConfirmed ?? []) {
    if (!row.start_time) continue;

    const { data: grp } = await supabase
      .from("groups")
      .select("last_hangout_at")
      .eq("id", row.group_id)
      .single();

    if (!grp) continue;

    const shouldUpdate =
      !grp.last_hangout_at ||
      new Date(row.start_time) > new Date(grp.last_hangout_at);

    if (shouldUpdate) {
      await supabase
        .from("groups")
        .update({ last_hangout_at: row.start_time })
        .eq("id", row.group_id);
      stampedGroups++;
    }
  }

  // ── Job 6: mark past confirmed hangouts as "completed" ───────────────────────
  // Runs after Job 5 so last_hangout_at is already stamped before status changes.
  // Using the same pastConfirmed rows (start_time < now, status = confirmed).
  let completed = 0;
  if ((pastConfirmed ?? []).length > 0) {
    const pastIds = (pastConfirmed ?? []).map((r: { id: string }) => r.id);
    const { error: completeError } = await supabase
      .from("hangout_suggestions")
      .update({ status: "completed" })
      .in("id", pastIds);

    if (!completeError) completed = pastIds.length;
  }

  // ── Job 7: unpause suggestions whose members' schedules have cleared ──────────
  // Find paused suggestions with start_time still in the future.
  // Re-run the per-user limit check; if all members are now < 2 confirmed
  // hangouts in the next 7 days, move the suggestion back to pending.
  const in7daysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pausedSuggestions } = await supabase
    .from("hangout_suggestions")
    .select("id, group_id, suggested_activity")
    .eq("status", "paused")
    .gt("start_time", now);

  let unpaused = 0;
  for (const suggestion of pausedSuggestions ?? []) {
    // Get all members of this group
    const memberIds = await getGroupMembers(suggestion.group_id);
    if (memberIds.length === 0) continue;

    // Get all groups any member belongs to
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("user_id", memberIds);

    const allGroupIds = [...new Set((memberships ?? []).map(
      (m: { group_id: string }) => m.group_id,
    ))];

    // Count confirmed hangouts in those groups in the next 7 days
    const { data: upcoming } = await supabase
      .from("hangout_suggestions")
      .select("group_id")
      .in("group_id", allGroupIds)
      .eq("status", "confirmed")
      .gt("start_time", now)
      .lte("start_time", in7daysIso);

    const confirmedGroupIds = new Set(
      (upcoming ?? []).map((h: { group_id: string }) => h.group_id),
    );

    const memberHangoutCount: Record<string, number> = {};
    for (const m of memberships ?? [] as { group_id: string; user_id: string }[]) {
      if (confirmedGroupIds.has(m.group_id)) {
        memberHangoutCount[m.user_id] = (memberHangoutCount[m.user_id] ?? 0) + 1;
      }
    }

    const allClear = memberIds.every(
      (id) => (memberHangoutCount[id] ?? 0) < 2,
    );

    if (allClear) {
      await supabase
        .from("hangout_suggestions")
        .update({ status: "pending" })
        .eq("id", suggestion.id);

      const msg = `Your schedule cleared up! ${suggestion.suggested_activity ?? "Your hangout"} is back on — go vote! 🎉`;
      await createNotifications(memberIds, suggestion.group_id, msg);
      unpaused++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      expiredVotes: (expiredVotes ?? []).length,
      expiredRsvps: (expiredRsvps ?? []).length,
      reminders: (expiringSoon ?? []).length,
      expiredInvites: (expiredInvites ?? []).length,
      stampedGroups,
      completed,
      unpaused,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
