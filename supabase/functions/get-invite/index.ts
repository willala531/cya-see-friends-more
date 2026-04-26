// get-invite — Supabase Edge Function (public, no auth required)
//
// Looks up an invite by its token and returns sanitised data for the
// /invite/:token page. Uses service_role so it bypasses RLS — only safe
// data (group name, inviter display name, status, expiry) is returned.
// The raw phone_number and user IDs are never included in the response.
//
// Request body:
//   { token: string }
//
// Response:
//   { groupName, inviterName, status, groupId, inviteId, expiresAt, isValid }

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token } = body;

  if (!token) {
    return new Response(JSON.stringify({ error: "token is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Look up the invite ──────────────────────────────────────────────────────

  const { data: invite, error } = await supabase
    .from("group_invites")
    .select(`
      id,
      status,
      expires_at,
      group_id,
      groups ( id, name ),
      users ( id, display_name )
    `)
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return new Response(
      JSON.stringify({ isValid: false, error: "Invite not found" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Determine validity ──────────────────────────────────────────────────────

  const isExpired = new Date(invite.expires_at) < new Date();
  const isValid = invite.status === "pending" && !isExpired;

  // If expired but status is still pending, update it now
  if (isExpired && invite.status === "pending") {
    await supabase
      .from("group_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
  }

  // ── Return sanitised payload ────────────────────────────────────────────────

  const group = Array.isArray(invite.groups) ? invite.groups[0] : invite.groups;
  const inviter = Array.isArray(invite.users) ? invite.users[0] : invite.users;

  return new Response(
    JSON.stringify({
      isValid,
      status: isExpired && invite.status === "pending" ? "expired" : invite.status,
      groupId: invite.group_id,
      inviteId: invite.id,
      groupName: group?.name ?? "a group",
      inviterName: inviter?.display_name ?? "Someone",
      expiresAt: invite.expires_at,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
