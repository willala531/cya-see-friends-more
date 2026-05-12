// _shared/cors.ts — single source of truth for CORS configuration.
//
// Import this in every Edge Function that is called directly from the browser.
// Server-to-server functions (create-calendar-event, check-expiry) don't need it.
//
// Usage in a handler:
//
//   import { corsHeaders, handleCors } from "../_shared/cors.ts";
//
//   Deno.serve(async (req) => {
//     const preflight = handleCors(req);
//     if (preflight) return preflight;          // ← respond to OPTIONS immediately
//
//     // ... your logic ...
//
//     return new Response(JSON.stringify(data), {
//       headers: { ...corsHeaders(req), "Content-Type": "application/json" },
//     });
//   });

const ALLOWED_ORIGINS = new Set([
  "https://www.see-friends.com",
  "https://see-friends.com",
  "http://localhost:8080",
  "http://localhost:5173",
]);

/**
 * Returns the CORS headers for a given request.
 * Echoes the request Origin back only if it is in the allow-list, so we never
 * accidentally expose the API to arbitrary domains via a wildcard.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/**
 * Handles the CORS preflight OPTIONS request.
 * Call this at the very top of your handler and return immediately if it
 * returns a Response — browsers send this before every cross-origin POST.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}
