import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || supabaseUrl === "undefined") {
  console.error(
    "[cya] MISSING ENV VAR: VITE_SUPABASE_URL is",
    supabaseUrl === undefined ? "undefined (not baked into bundle)" : JSON.stringify(supabaseUrl),
    "— all Supabase calls will fail with 403.",
  );
}

if (!supabaseAnonKey || supabaseAnonKey === "undefined") {
  console.error(
    "[cya] MISSING ENV VAR: VITE_SUPABASE_ANON_KEY is",
    supabaseAnonKey === undefined ? "undefined (not baked into bundle)" : JSON.stringify(supabaseAnonKey),
    "— all Supabase calls will fail with 403.",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
