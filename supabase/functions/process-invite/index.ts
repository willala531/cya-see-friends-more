// process-invite — Supabase Edge Function
//
// Handles four invite actions:
//   "accept"        — validates token, adds user to group_members, marks invite accepted
//   "decline"       — marks invite declined (no group join)
//   "phone-match"   — after onboarding: finds all pending invites for a phone number
//                     and auto-accepts them (adds user to each group)
//   "accept-direct" — in-app accept for existing users: validates by inviteId + userId
//                     (no token required), adds user to group_members
//
// Uses service_role to bypass RLS for all writes.
//
// Request body:
//   { token?: string, inviteId?: string, phoneNumber?: string, userId: string,
//     type: "accept" | "decline" | "phone-match" | "accept-direct" }
//
// Response:
//   { ok: boolean, groupId?: string, groupName?: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function acceptInvite(
  inviteId: string,
  groupId: string,
  userId: string,
): Promise<void> {
  // Idempotent: only insert if not already a member
  const { data: existing } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
      can_invite: false,
    });
  }

  await supabase
    .from("group_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    token?: string;
    inviteId?: string;
    phoneNumber?: string;
    userId?: string;
    type?: "accept" | "decline" | "phone-match" | "accept-direct";
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const { token, inviteId, phoneNumber, userId, type } = body;

  if (!userId || !type) {
    return new Response(
      JSON.stringify({ ok: false, error: "userId and type are required" }),
      { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  // ── accept / decline (token-based) ─────────────────────────────────────────

  if (type === "accept" || type === "decline") {
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "token is required for accept/decline" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Look up the invite
    const { data: invite, error } = await supabase
      .from("group_invites")
      .select(`
        id,
        group_id,
        status,
        expires_at,
        groups ( id, name )
      `)
      .eq("token", token)
      .maybeSingle();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invite not found" }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Check validity
    const isExpired = new Date(invite.expires_at) < new Date();
    if (invite.status !== "pending" || isExpired) {
      if (isExpired && invite.status === "pending") {
        await supabase
          .from("group_invites")
          .update({ status: "expired" })
          .eq("id", invite.id);
      }
      return new Response(
        JSON.stringify({ ok: false, error: "Invite has expired or already been used" }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const group = Array.isArray(invite.groups) ? invite.groups[0] : invite.groups;

    if (type === "accept") {
      await acceptInvite(invite.id, invite.group_id, userId);
      return new Response(
        JSON.stringify({
          ok: true,
          groupId: invite.group_id,
          groupName: group?.name ?? "",
        }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // decline
    await supabase
      .from("group_invites")
      .update({ status: "declined" })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  // ── phone-match: auto-join all groups where this phone has a pending invite ──

  if (type === "phone-match") {
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ ok: false, error: "phoneNumber required for phone-match" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();
    const { data: pendingInvites } = await supabase
      .from("group_invites")
      .select("id, group_id")
      .eq("phone_number", phoneNumber)
      .eq("status", "pending")
      .gt("expires_at", now);

    for (const invite of pendingInvites ?? []) {
      await acceptInvite(invite.id, invite.group_id, userId);
    }

    return new Response(
      JSON.stringify({ ok: true, joined: (pendingInvites ?? []).length }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  // ── accept-direct: in-app accept for existing cya users ───────────────────
  // Validates by inviteId + userId (no token required). The invited_user_id on
  // the row must match the caller to prevent accepting someone else's invite.

  if (type === "accept-direct") {
    if (!inviteId) {
      return new Response(
        JSON.stringify({ ok: false, error: "inviteId is required for accept-direct" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { data: invite, error } = await supabase
      .from("group_invites")
      .select(`
        id,
        group_id,
        status,
        expires_at,
        invited_user_id,
        groups ( id, name )
      `)
      .eq("id", inviteId)
      .maybeSingle();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invite not found" }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Security check: only the intended user can accept
    if (invite.invited_user_id !== userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not authorized to accept this invite" }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const isExpired = new Date(invite.expires_at) < new Date();
    if (invite.status !== "pending" || isExpired) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invite has expired or already been used" }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const group = Array.isArray(invite.groups) ? invite.groups[0] : invite.groups;
    await acceptInvite(invite.id, invite.group_id, userId);

    return new Response(
      JSON.stringify({ ok: true, groupId: invite.group_id, groupName: group?.name ?? "" }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: false, error: "Unknown type" }),
    { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
  );
});
