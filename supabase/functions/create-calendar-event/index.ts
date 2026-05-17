// create-calendar-event — Supabase Edge Function
// For each user who RSVPd "yes", exchange their refresh token for an
// access token and create a Google Calendar event on their behalf.
//
// Request body:
//   { hangoutId, activityName, groupId, startTime, endTime, yesUserIds }

import { createClient } from "npm:@supabase/supabase-js@2";

// ── Startup diagnostics ───────────────────────────────────────────────────────
// This log fires before Deno.serve registers. If the function crashes before
// printing this, the issue is earlier (bad import, Deno version, etc.).
console.log("[create-calendar-event] module loading…");

const REQUIRED_SECRETS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

for (const key of REQUIRED_SECRETS) {
  const present = !!Deno.env.get(key);
  console.log(`[create-calendar-event] ${key}: ${present ? "✓ present" : "✗ MISSING"}`);
}

let supabase: ReturnType<typeof createClient>;
let GOOGLE_CLIENT_ID: string;
let GOOGLE_CLIENT_SECRET: string;

try {
  supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  console.log("[create-calendar-event] module initialised OK");
} catch (err) {
  console.error("[create-calendar-event] FATAL — module-level init failed:", err);
  throw err; // re-throw so Deno surfaces the error in function logs
}

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return (data.access_token as string) ?? null;
}

async function createEvent(
  accessToken: string,
  summary: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        description: "Organized by cya — See Friends More",
      }),
    },
  );
  return res.ok;
}

console.log("[create-calendar-event] Deno.serve registering…");

Deno.serve(async (req) => {
  console.log("[create-calendar-event] request received:", req.method);

  try {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: {
    hangoutId: string;
    activityName: string;
    groupId: string;
    startTime: string;
    endTime: string;
    yesUserIds: string[];
  };
  try {
    body = await req.json();
  } catch (parseErr) {
    console.error("[create-calendar-event] failed to parse request body:", parseErr);
    return new Response("Invalid JSON body", { status: 400 });
  }

  const {
    hangoutId,
    activityName,
    groupId,
    startTime,
    endTime,
    yesUserIds,
  } = body;

  if (!yesUserIds?.length) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch the group name for the event title
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  const summary = `${activityName} with ${group?.name ?? "the group"} 🗓️`;

  // Fetch refresh tokens for all yes users
  const { data: users } = await supabase
    .from("users")
    .select("id, google_refresh_token")
    .in("id", yesUserIds);

  const failedUserIds: string[] = [];

  await Promise.all(
    (users ?? []).map(
      async (u: { id: string; google_refresh_token: string | null }) => {
        if (!u.google_refresh_token) {
          failedUserIds.push(u.id);
          return;
        }

        const accessToken = await getAccessToken(u.google_refresh_token);
        if (!accessToken) {
          failedUserIds.push(u.id);
          return;
        }

        const ok = await createEvent(accessToken, summary, startTime, endTime);
        if (!ok) failedUserIds.push(u.id);
      },
    ),
  );

  // Create "reconnect Google" notifications for users whose token failed
  if (failedUserIds.length > 0) {
    await supabase.from("notifications").insert(
      failedUserIds.map((user_id) => ({
        user_id,
        group_id: groupId,
        message:
          "Your Google Calendar connection expired. Reconnect in Settings to get events added automatically.",
      })),
    );
  }

  return new Response(
    JSON.stringify({ ok: true, failedUserIds }),
    { headers: { "Content-Type": "application/json" } },
  );

  } catch (err) {
    console.error("[create-calendar-event] unhandled error in request handler:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
