import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // This shows up in the browser console, not to your members — it just
  // helps you notice a missing .env file while setting things up.
  console.error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your project URL and anon key."
  );
}

export const supabase = createClient(url || "", anonKey || "");
