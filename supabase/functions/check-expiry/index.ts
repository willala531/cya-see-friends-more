// check-expiry — Supabase Edge Function (scheduled, runs hourly)
// Handles three time-based jobs:
//   1. Resolve expired votes (vote_expires_at < NOW, vote_options != null)
//   2. Cancel expired RSVPs (rsvp_expires_at < NOW, status = pending)
//   3. Send 24-hour reminder (rsvp_expires_at within next 24h, reminder not sent)

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

  return new Response(
    JSON.stringify({
      ok: true,
      expiredVotes: (expiredVotes ?? []).length,
      expiredRsvps: (expiredRsvps ?? []).length,
      reminders: (expiringSoon ?? []).length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
