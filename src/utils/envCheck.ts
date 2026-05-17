/**
 * checkEnvVars — called once on app startup.
 *
 * Logs every VITE_ environment variable and whether it is present or missing.
 * Values are masked (never logged in full) so this is safe to leave in
 * production builds — it only tells you *which* variables exist, not what
 * they contain.
 *
 * In the Vercel deployment logs (or browser console on first load) you will
 * see a line like:
 *
 *   [cya] env check  VITE_SUPABASE_URL=✓ present  VITE_SUPABASE_ANON_KEY=✗ MISSING  VITE_VAPID_PUBLIC_KEY=✓ present
 *
 * Any variable shown as "✗ MISSING" was not baked into the bundle at build
 * time — check Vercel → Project Settings → Environment Variables and confirm
 * the variable is enabled for the Production environment, then redeploy.
 */

// All VITE_ variables used anywhere in the app.
const EXPECTED_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_VAPID_PUBLIC_KEY",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_PUBLIC_POSTHOG_KEY",
  "VITE_PUBLIC_POSTHOG_HOST",
] as const;

function status(value: string | undefined): string {
  if (value === undefined || value === "undefined" || value === "") return "✗ MISSING";
  return "✓ present";
}

export function checkEnvVars(): void {
  const env = import.meta.env;

  const report = EXPECTED_VARS.map(
    (key) => `${key}=${status(env[key] as string | undefined)}`,
  ).join("  ");

  const anyMissing = EXPECTED_VARS.some((key) => {
    const v = env[key] as string | undefined;
    return !v || v === "undefined";
  });

  if (anyMissing) {
    console.error("[cya] env check — ONE OR MORE VARS MISSING:", report);
  } else {
    console.log("[cya] env check —", report);
  }
}
