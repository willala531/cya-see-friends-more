// create-invite — Supabase Edge Function
//
// Generates a secure invite token and handles two paths:
//
//   Existing cya user (phone number found in users table):
//     • Skips SMS
//     • Creates a group_invites row with invited_user_id set
//     • Sends an in-app notification to the invited user
//     • Returns { type: "existing_user", message: string }
//
//   New user (phone not found):
//     • Creates a group_invites row (no invited_user_id)
//     • Sends a Twilio SMS with the invite link
//     • Returns { type: "new_user", token, inviteUrl, inviteId, warning? }
//
// Resend behaviour: if a pending invite for the same (group_id, phone_number)
// already exists, the token and expiry are refreshed in-place.
//
// Request body:
//   { groupId: string, phoneNumber: string, invitedByUserId: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

function getBaseUrl(): string {
  return Deno.env.get("SITE_URL") ?? "http://localhost:8080";
}

// ─── Twilio SMS ───────────────────────────────────────────────────────────────

interface TwilioResult {
  sent: boolean;
  warning?: string;
}

async function sendTwilioSms(to: string, body: string): Promise<TwilioResult> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    console.error("[create-invite] Twilio secrets missing — skipping SMS");
    return { sent: false, warning: "SMS not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
  const credentials = btoa(`${accountSid}:${authToken}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const json = await res.json();

    if (!res.ok) {
      const code = json?.code;
      console.error(`[create-invite] Twilio error ${res.status} code=${code}:`, json?.message);

      // 21608 = unverified number on a Twilio trial account
      if (code === 21608) {
        return {
          sent: false,
          warning: "SMS delivery requires phone number verification during testing.",
        };
      }
      return { sent: false };
    }

    console.log("[create-invite] SMS sent, sid:", json?.sid);
    return { sent: true };
  } catch (err) {
    console.error("[create-invite] Twilio fetch error:", err);
    return { sent: false };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { groupId?: string; phoneNumber?: string; invitedByUserId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const { groupId, phoneNumber, invitedByUserId } = body;

  if (!groupId || !phoneNumber || !invitedByUserId) {
    return new Response(
      JSON.stringify({ error: "groupId, phoneNumber, and invitedByUserId are required" }),
      { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  if (!isE164(phoneNumber)) {
    return new Response(
      JSON.stringify({ error: "phoneNumber must be in E.164 format, e.g. +13105551234" }),
      { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  console.log(`[create-invite] groupId=${groupId} phone=${phoneNumber} by=${invitedByUserId}`);

  // ── Fetch inviter display_name and group name (needed for both paths) ─────

  const [{ data: inviter }, { data: group }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", invitedByUserId).single(),
    supabase.from("groups").select("name").eq("id", groupId).single(),
  ]);

  const inviterName = inviter?.display_name ?? "Someone";
  const groupName = group?.name ?? "a group";

  // ── Check for existing pending invite (resend) ────────────────────────────

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

  // ── Check whether the phone belongs to an existing cya user ──────────────

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  // ── Upsert the invite row ─────────────────────────────────────────────────

  let inviteId: string;

  if (existing) {
    // Resend: refresh token + expiry
    const { data: updated, error } = await supabase
      .from("group_invites")
      .update({
        token,
        expires_at: expiresAt,
        invited_by: invitedByUserId,
        invited_user_id: existingUser?.id ?? null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) {
      console.error("[create-invite] update error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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
        invited_user_id: existingUser?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[create-invite] insert error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    inviteId = created.id;
  }

  // ── Branch: existing user → in-app notification; new user → SMS ──────────

  if (existingUser) {
    console.log(`[create-invite] existing user ${existingUser.id} — sending in-app notification`);

    // Send in-app notification to the invited user
    await supabase.from("notifications").insert({
      user_id: existingUser.id,
      group_id: groupId,
      message: `${inviterName} invited you to join "${groupName}" on cya`,
    });

    return new Response(
      JSON.stringify({
        type: "existing_user",
        message: "They'll see the invite in the app.",
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  // New user — send SMS
  const smsBody =
    `${inviterName} invited you to hang out on cya! ` +
    `Join their group "${groupName}": ${inviteUrl}`;

  const { sent, warning } = await sendTwilioSms(phoneNumber, smsBody);

  if (!sent) {
    console.warn("[create-invite] SMS not delivered — invite row saved anyway");
  }

  return new Response(
    JSON.stringify({
      type: "new_user",
      token,
      inviteUrl,
      inviteId,
      ...(warning ? { warning } : {}),
    }),
    { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
  );
});
