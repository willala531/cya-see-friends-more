import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkEnvVars } from "./utils/envCheck";
import posthog from "posthog-js";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";

// Runs before anything else — log env var presence to console so we can
// diagnose missing variables in production builds without exposing values.
checkEnvVars();

// Diagnostic log specifically for PostHog so the token presence is visible
// even before PostHog itself initialises (where it would otherwise swallow
// the error silently or throw "initialized without a token").
console.log(
  "[cya] posthog key:",
  import.meta.env.VITE_PUBLIC_POSTHOG_KEY
    ? "✓ present"
    : "✗ MISSING — PostHog will not initialise",
);

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
});

createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <PostHogErrorBoundary>
      <App />
    </PostHogErrorBoundary>
  </PostHogProvider>
);
