// process-hangout-decision — Supabase Edge Function
// Idempotent orchestrator for all RSVP decision outcomes.
// Called from the frontend after every RSVP change when a threshold is reached.
//
// Request body:
//   { type: "confirm" | "cancel" | "vote" | "vote_resolved", hangoutId: string,
//     voteOptions?: { originalId, alt1Id, alt2Id } }

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getGroupMembers(groupId: string) {
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

async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  groupId: string,
) {
  if (userIds.length === 0) return;
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, groupId });
  await Promise.allSettled(
    subs.map((row: { subscription: PushSubscriptionJSON }) =>
      webpush.sendNotification(row.subscription as webpush.PushSubscription, payload),
    ),
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    type: string;
    hangoutId: string;
    voteOptions?: { originalId: string | null; alt1Id: string | null; alt2Id: string | null };
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders(req) });
  }

  const { type, hangoutId, voteOptions } = body;

  // Fetch the hangout
  const { data: hangout, error: hangoutError } = await supabase
    .from("hangout_suggestions")
    .select("*, rsvps(*)")
    .eq("id", hangoutId)
    .single();

  if (hangoutError || !hangout) {
    return new Response("Hangout not found", { status: 404, headers: corsHeaders(req) });
  }

  const groupId: string = hangout.group_id;
  const activityName: string = hangout.suggested_activity ?? "Hangout";
  const dateLabel = hangout.start_time
    ? new Date(hangout.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "soon";
  const timeLabel = hangout.start_time
    ? new Date(hangout.start_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const allMemberIds = await getGroupMembers(groupId);

  // ── confirm ────────────────────────────────────────────────────────────────
  if (type === "confirm") {
    if (hangout.status !== "pending") {
      return new Response("Already resolved", { status: 200, headers: corsHeaders(req) });
    }

    // ── Rule 2: per-user global limit — max 2 confirmed hangouts per 7-day window ──
    // If any member already has ≥ 2 confirmed hangouts in the next 7 days across
    // all their groups, pause this suggestion instead of confirming it.
    const nowIso = new Date().toISOString();
    const in7daysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all group IDs that any member of this group belongs to
    const { data: allMemberships } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("user_id", allMemberIds);

    const allGroupIds = [...new Set((allMemberships ?? []).map(
      (m: { group_id: string }) => m.group_id,
    ))];

    // Find all confirmed hangouts in those groups starting in the next 7 days
    const { data: upcomingConfirmed } = await supabase
      .from("hangout_suggestions")
      .select("id, group_id, start_time")
      .in("group_id", allGroupIds)
      .eq("status", "confirmed")
      .gt("start_time", nowIso)
      .lte("start_time", in7daysIso);

    // Build a set of group IDs with confirmed hangouts
    const confirmedGroupIds = new Set(
      (upcomingConfirmed ?? []).map((h: { group_id: string }) => h.group_id),
    );

    // For each member, count how many of their groups have a confirmed hangout
    // in the next 7 days (1 group = 1 hangout commitment, regardless of
    // multiple suggestions per group)
    const memberHangoutCount: Record<string, number> = {};
    for (const m of allMemberships ?? [] as { group_id: string; user_id: string }[]) {
      if (confirmedGroupIds.has(m.group_id)) {
        memberHangoutCount[m.user_id] = (memberHangoutCount[m.user_id] ?? 0) + 1;
      }
    }

    const overloadedMemberIds = allMemberIds.filter(
      (id) => (memberHangoutCount[id] ?? 0) >= 2,
    );

    if (overloadedMemberIds.length > 0) {
      // Pause the suggestion — check-expiry will unpause once schedules clear
      await supabase
        .from("hangout_suggestions")
        .update({ status: "paused" })
        .eq("id", hangoutId);

      const pauseMsg =
        "You've got a busy week! We'll lock this in once your schedule clears up 📅";
      await createNotifications(allMemberIds, groupId, pauseMsg);
      await sendPushToUsers(
        allMemberIds,
        "Busy week ahead 📅",
        pauseMsg,
        groupId,
      );

      return new Response(JSON.stringify({ ok: true, paused: true }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    // ── End Rule 2 ──────────────────────────────────────────────────────────────

    await supabase
      .from("hangout_suggestions")
      .update({ status: "confirmed" })
      .eq("id", hangoutId);

    const rsvps: { user_id: string; response: string }[] = hangout.rsvps ?? [];
    const yesUserIds = rsvps.filter((r) => r.response === "yes").map((r) => r.user_id);
    const notYetIds = allMemberIds.filter((id) => !rsvps.find((r) => r.user_id === id));

    const confirmMsg = `🎉 It's happening! ${activityName} on ${dateLabel} at ${timeLabel} is confirmed.`;
    const lateMsg = `Your friends are hanging out without you! ${activityName} on ${dateLabel} is confirmed — are you in?`;

    await createNotifications(yesUserIds, groupId, confirmMsg);
    if (notYetIds.length > 0) {
      await createNotifications(notYetIds, groupId, lateMsg);
    }
    await sendPushToUsers(yesUserIds, "🎉 It's on!", confirmMsg, groupId);
    if (notYetIds.length > 0) {
      await sendPushToUsers(notYetIds, "Your friends are hanging out!", lateMsg, groupId);
    }

    // Invoke create-calendar-event for yes-RSVPs
    if (yesUserIds.length > 0) {
      await supabase.functions.invoke("create-calendar-event", {
        body: {
          hangoutId,
          activityName,
          groupId,
          startTime: hangout.start_time,
          endTime: hangout.end_time,
          yesUserIds,
        },
      });
    }
  }

  // ── cancel ─────────────────────────────────────────────────────────────────
  else if (type === "cancel") {
    if (hangout.status !== "pending") {
      return new Response("Already resolved", { status: 200, headers: corsHeaders(req) });
    }

    await supabase
      .from("hangout_suggestions")
      .update({ status: "cancelled" })
      .eq("id", hangoutId);

    const msg = `Looks like ${activityName} isn't happening. We'll find another time! 📅`;
    await createNotifications(allMemberIds, groupId, msg);
    await sendPushToUsers(allMemberIds, "Plans changed 📅", msg, groupId);
  }

  // ── vote ───────────────────────────────────────────────────────────────────
  else if (type === "vote") {
    if (hangout.vote_options != null) {
      return new Response("Vote already started", { status: 200, headers: corsHeaders(req) });
    }
    if (!voteOptions) {
      return new Response("voteOptions required", { status: 400, headers: corsHeaders(req) });
    }

    const voteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("hangout_suggestions")
      .update({ vote_options: voteOptions, vote_expires_at: voteExpiresAt })
      .eq("id", hangoutId);

    const msg = `Someone in the group doesn't vibe with ${activityName} — let's take a vote! 🗳️ You have 24 hours.`;
    await createNotifications(allMemberIds, groupId, msg);
    await sendPushToUsers(allMemberIds, "Activity vote! 🗳️", msg, groupId);
  }

  // ── vote_resolved ──────────────────────────────────────────────────────────
  else if (type === "vote_resolved") {
    const opts = hangout.vote_options as {
      originalId: string | null;
      alt1Id: string | null;
      alt2Id: string | null;
    } | null;
    if (!opts) {
      return new Response("No vote in progress", { status: 200, headers: corsHeaders(req) });
    }

    // Tally votes
    const { data: votes } = await supabase
      .from("hangout_votes")
      .select("activity_id")
      .eq("hangout_id", hangoutId);

    const tally: Record<string, number> = {};
    for (const v of (votes ?? []) as { activity_id: string }[]) {
      tally[v.activity_id] = (tally[v.activity_id] ?? 0) + 1;
    }

    // Winner = most votes; original wins ties
    const candidates = [opts.originalId, opts.alt1Id, opts.alt2Id].filter(Boolean) as string[];
    let winner = opts.originalId ?? candidates[0];
    let maxVotes = tally[winner] ?? 0;
    for (const id of candidates) {
      const v = tally[id] ?? 0;
      if (v > maxVotes) {
        maxVotes = v;
        winner = id;
      }
    }

    // Fetch winning activity name from the activities library
    // (We need to load the activity name — stored as ID in vote_options)
    // The activity name is already in the hangout if winner === originalId,
    // otherwise we update suggested_activity with the alt name.
    // We'll store the winning_activity_id and clear vote_options.
    await supabase
      .from("hangout_suggestions")
      .update({ winning_activity_id: winner, vote_options: null })
      .eq("id", hangoutId);

    const msg = `The votes are in! Update your RSVP for ${activityName} on ${dateLabel}.`;
    await createNotifications(allMemberIds, groupId, msg);
    await sendPushToUsers(allMemberIds, "Votes are in! 🗳️", msg, groupId);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});
