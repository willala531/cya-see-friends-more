// send-feedback-email — Supabase Edge Function
//
// Triggered by a Supabase Database Webhook whenever a row is inserted into
// public.feedback. Sends a formatted notification email to the cya team
// using the Resend API (https://resend.com).
//
// ⚠️  SETUP REQUIRED:
//   1. Create a free Resend account at https://resend.com (3,000 emails/month free)
//   2. Add your Resend API key as a Supabase Edge Function secret:
//        supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//   3. In Resend, verify the domain "see-friends.com" so noreply@see-friends.com
//      is authorised as a sender.
//   4. Set up the Database Webhook in the Supabase dashboard — see instructions
//      at the bottom of this file.
//
// ⚠️  TO_EMAIL below is a placeholder — update to your real team inbox.

import { corsHeaders, handleCors } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// ⚠️  TODO: Replace with your real team email address
const TO_EMAIL = "hello@see-friends.com";
const FROM_EMAIL = "cya feedback <noreply@see-friends.com>";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackRow {
  id: string;
  user_id: string | null;
  type: "bug" | "suggestion";
  page: string | null;
  message: string;
  browser: string | null;
  os: string | null;
  screen_resolution: string | null;
  app_version: string | null;
  user_email: string | null;
  user_display_name: string | null;
  created_at: string;
}

// The webhook payload wraps the inserted row under a "record" key.
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: FeedbackRow;
  schema: string;
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildSubject(row: FeedbackRow): string {
  if (row.type === "bug") {
    const pagePart = row.page ? ` — ${row.page}` : "";
    return `[cya Feedback] 🐛 Bug Report${pagePart}`;
  }
  return "[cya Feedback] 💡 New Suggestion";
}

function buildHtml(row: FeedbackRow): string {
  const date = new Date(row.created_at).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });

  const field = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top;font-size:13px">${label}</td><td style="padding:6px 0;font-size:13px">${value}</td></tr>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f9f9f9;margin:0;padding:24px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">

    <div style="background:${row.type === "bug" ? "#fff3f3" : "#f0f7ff"};padding:20px 24px;border-bottom:1px solid #e5e5e5">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:#888;text-transform:uppercase">cya feedback</p>
      <h1 style="margin:0;font-size:20px;font-weight:600;color:#111">
        ${row.type === "bug" ? "🐛 Bug Report" : "💡 Suggestion"}
      </h1>
      ${row.page ? `<p style="margin:6px 0 0;font-size:13px;color:#555">Page: <strong>${row.page}</strong></p>` : ""}
    </div>

    <div style="padding:20px 24px">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;color:#888;text-transform:uppercase">Message</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#222;background:#f9f9f9;padding:14px;border-radius:8px;white-space:pre-wrap">${row.message}</p>

      <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;color:#888;text-transform:uppercase">Submitted by</p>
      <table style="border-collapse:collapse;margin-bottom:24px">
        ${field("Name", row.user_display_name ?? "Anonymous")}
        ${field("Email", row.user_email)}
        ${field("User ID", row.user_id)}
        ${field("Submitted", date)}
      </table>

      <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;color:#888;text-transform:uppercase">Technical context</p>
      <table style="border-collapse:collapse">
        ${field("Browser", row.browser)}
        ${field("OS", row.os)}
        ${field("Screen", row.screen_resolution)}
        ${field("App version", row.app_version)}
      </table>
    </div>

    <div style="padding:14px 24px;border-top:1px solid #e5e5e5;background:#fafafa">
      <p style="margin:0;font-size:11px;color:#aaa">Feedback ID: ${row.id}</p>
    </div>

  </div>
</body>
</html>`.trim();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // This function is called by a DB webhook (POST from Supabase infra) and
  // also needs to handle CORS for any manual test calls from the browser.
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (!RESEND_API_KEY) {
    console.error("[send-feedback-email] RESEND_API_KEY secret is not set");
    return new Response(
      JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders(req) });
  }

  if (payload.type !== "INSERT") {
    // Only act on new inserts; ignore updates/deletes gracefully
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const row = payload.record;
  const subject = buildSubject(row);
  const html = buildHtml(row);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    console.error("[send-feedback-email] Resend API error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err }),
      { status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const resendData = await resendRes.json();
  console.log("[send-feedback-email] email sent, id:", resendData.id);

  return new Response(JSON.stringify({ ok: true, emailId: resendData.id }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});

// ─── Webhook setup instructions ──────────────────────────────────────────────
//
// After deploying this function, set up the Database Webhook in Supabase:
//
// 1. Go to Supabase Dashboard → Database → Webhooks → "Create a new hook"
// 2. Name: "feedback-email"
// 3. Table: public.feedback
// 4. Events: ✅ INSERT  (leave UPDATE and DELETE unchecked)
// 5. Webhook URL:
//      https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-feedback-email
// 6. HTTP Method: POST
// 7. HTTP Headers — add one header:
//      Authorization: Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>
// 8. Click "Create webhook"
//
// Supabase will POST the full row as JSON to this function on every insert.
