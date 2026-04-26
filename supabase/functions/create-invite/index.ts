// create-invite — Supabase Edge Function
//
// Generates a secure invite token, stores it in group_invites, and returns
// the invite URL. If a pending invite already exists for the same
// (group_id, phone_number) pair, the existing row is updated with a fresh
// token and a new 7-day expiry window (resend behaviour).
//
// Request body:
//   { groupId: string, phoneNumber: string, invitedByUserId: string }
//
// Response:
//   { token: string, inviteUrl: string, inviteId: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── E.164 validation ─────────────────────────────────────────────────────────

function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

// ─── Base URL for invite links ─────────────────────────────────────────────────
// Phase B: replace this with your production domain.
function getBaseUrl(): string {
  const siteUrl = Deno.env.get("SITE_URL");
  return siteUrl ?? "http://localhost:8080";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { groupId?: string; phoneNumber?: string; invitedByUserId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { groupId, phoneNumber, invitedByUserId } = body;

  // ── Input validation ────────────────────────────────────────────────────────

  if (!groupId || !phoneNumber || !invitedByUserId) {
    return new Response(
      JSON.stringify({ error: "groupId, phoneNumber, and invitedByUserId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!isE164(phoneNumber)) {
    return new Response(
      JSON.stringify({ error: "phoneNumber must be in E.164 format, e.g. +13105551234" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Check for existing pending invite (resend path) ─────────────────────────

  const { data: existing } = await supabase
    .from("group_invites")
    .select("id")
    .eq("group_id", groupId)
    .eq("phone_number", phoneNumber)
    .eq("status", "pending")
    .maybeSingle();

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const inviteUrl = `${getBaseUrl()}/invite/${token}`;

  let inviteId: string;

  if (existing) {
    // Resend: update token + expiry on the existing row
    const { data: updated, error } = await supabase
      .from("group_invites")
      .update({ token, expires_at: expiresAt, invited_by: invitedByUserId })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    inviteId = updated.id;
  } else {
    // New invite
    const { data: created, error } = await supabase
      .from("group_invites")
      .insert({
        group_id: groupId,
        phone_number: phoneNumber,
        invited_by: invitedByUserId,
        token,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    inviteId = created.id;
  }

  // ── TODO: Phase B — replace this comment block with Twilio SMS send ──────────
  //
  // When Twilio is wired in (Phase B), add the following here:
  //
  //   const twilio = new Twilio(
  //     Deno.env.get("TWILIO_ACCOUNT_SID")!,
  //     Deno.env.get("TWILIO_AUTH_TOKEN")!,
  //   );
  //   await twilio.messages.create({
  //     from: Deno.env.get("TWILIO_FROM_NUMBER")!,
  //     to: phoneNumber,
  //     body: `You've been invited to join a group on cya! Tap here to join: ${inviteUrl}`,
  //   });
  //
  // Also update supabase/config.toml to add TWILIO_* to the function's env vars.
  // ─────────────────────────────────────────────────────────────────────────────

  return new Response(
    JSON.stringify({ token, inviteUrl, inviteId }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
