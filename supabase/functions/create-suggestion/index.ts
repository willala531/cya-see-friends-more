// create-suggestion — Supabase Edge Function
// Rate-limited wrapper around hangout_suggestions.insert().
//
// Enforces two per-group cooldown rules before inserting:
//   Rule 1a — 7-day cooldown: groups.last_hangout_at must be > 7 days ago (or null).
//   Rule 1b — 48-hour retry: no cancelled/expired suggestion for this group in the
//             last 48 hours (prevents spam-retrying after a failed suggestion).
//
// Request body:
//   { groupId, suggestedActivity, startTime, endTime }
//
// Responses:
//   200 { ok: true, suggestion: DbHangoutSuggestion }  — inserted OK
//   200 { ok: false, reason: "cooldown" | "retry_cooldown" | "already_pending" }
//   400 Bad request
//   404 Group not found

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(req) });
  }

  let body: {
    groupId: string;
    suggestedActivity: string;
    startTime: string;
    endTime: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders(req) });
  }

  const { groupId, suggestedActivity, startTime, endTime } = body;

  if (!groupId || !suggestedActivity || !startTime || !endTime) {
    return new Response("Missing required fields", { status: 400, headers: corsHeaders(req) });
  }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  // ── Fetch group ──────────────────────────────────────────────────────────────
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, last_hangout_at")
    .eq("id", groupId)
    .single();

  if (groupError || !group) {
    return new Response("Group not found", { status: 404, headers: corsHeaders(req) });
  }

  const now = new Date();

  // ── Rule 1a: 7-day cooldown since last confirmed hangout ─────────────────────
  if (group.last_hangout_at) {
    const lastHangout = new Date(group.last_hangout_at);
    const daysSince = (now.getTime() - lastHangout.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      return json({ ok: false, reason: "cooldown" });
    }
  }

  // ── Rule 1b: 48-hour retry cooldown after cancelled/expired suggestion ────────
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentFailed } = await supabase
    .from("hangout_suggestions")
    .select("id")
    .eq("group_id", groupId)
    .in("status", ["cancelled", "expired"])
    .gt("created_at", cutoff48h)
    .limit(1);

  if (recentFailed && recentFailed.length > 0) {
    return json({ ok: false, reason: "retry_cooldown" });
  }

  // ── Guard: bail if there's already a pending or paused suggestion ─────────────
  const { data: existing } = await supabase
    .from("hangout_suggestions")
    .select("id")
    .eq("group_id", groupId)
    .in("status", ["pending", "paused"])
    .limit(1);

  if (existing && existing.length > 0) {
    return json({ ok: false, reason: "already_pending" });
  }

  // ── Insert the suggestion ────────────────────────────────────────────────────
  const rsvpExpiresAt = new Date(
    new Date(startTime).getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: suggestion, error: insertError } = await supabase
    .from("hangout_suggestions")
    .insert({
      group_id: groupId,
      suggested_activity: suggestedActivity,
      start_time: startTime,
      end_time: endTime,
      status: "pending",
      rsvp_expires_at: rsvpExpiresAt,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[create-suggestion] insert error:", insertError);
    return new Response("Failed to create suggestion", {
      status: 500,
      headers: corsHeaders(req),
    });
  }

  return json({ ok: true, suggestion });
});
