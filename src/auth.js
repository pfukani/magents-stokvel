import { supabase } from "./supabaseClient.js";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Looks up whether the signed-in email is on the club's access list, and
// what role they have. Returns null if they're not registered.
export async function fetchMyAccess(email) {
  const { data, error } = await supabase
    .from("allowed_users")
    .select("email, role")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAllowedUsers() {
  const { data, error } = await supabase
    .from("allowed_users")
    .select("email, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addAllowedUser(email, role) {
  const { error } = await supabase
    .from("allowed_users")
    .insert({ email: email.trim().toLowerCase(), role });
  if (error) throw error;
}

export async function updateAllowedUserRole(email, role) {
  const { error } = await supabase.from("allowed_users").update({ role }).eq("email", email);
  if (error) throw error;
}

export async function removeAllowedUser(email) {
  const { error } = await supabase.from("allowed_users").delete().eq("email", email);
  if (error) throw error;
}
