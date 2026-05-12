import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkEnvVars } from "./utils/envCheck";

// Runs before anything else — log env var presence to console so we can
// diagnose missing variables in production builds without exposing values.
checkEnvVars();

createRoot(document.getElementById("root")!).render(<App />);
