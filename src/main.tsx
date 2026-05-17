import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkEnvVars } from "./utils/envCheck";
import posthog from "posthog-js";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";

// Runs before anything else — log env var presence to console so we can
// diagnose missing variables in production builds without exposing values.
checkEnvVars();

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
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
