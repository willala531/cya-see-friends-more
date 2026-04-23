// create-calendar-event — Supabase Edge Function
// For each user who RSVPd "yes", exchange their refresh token for an
// access token and create a Google Calendar event on their behalf.
//
// Request body:
//   { hangoutId, activityName, groupId, startTime, endTime, yesUserIds }

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
        description: "Organized by CYA — See Friends More",
      }),
    },
  );
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const {
    hangoutId,
    activityName,
    groupId,
    startTime,
    endTime,
    yesUserIds,
  }: {
    hangoutId: string;
    activityName: string;
    groupId: string;
    startTime: string;
    endTime: string;
    yesUserIds: string[];
  } = await req.json();

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
});
