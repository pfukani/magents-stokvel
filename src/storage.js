import { supabase } from "./supabaseClient.js";

// A tiny key/value layer on top of a single Supabase table, so the rest of
// the app can just call storageGet(key) / storageSet(key, value) without
// knowing anything about SQL. Table: kv_store (key text primary key, value jsonb).

export async function storageGet(key) {
  const { data, error } = await supabase
    .from("kv_store")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function storageSet(key, value) {
  const { error } = await supabase
    .from("kv_store")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
