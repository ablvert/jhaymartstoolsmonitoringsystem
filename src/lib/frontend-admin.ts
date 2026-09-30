import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail, authPassword } from "./bootstrap.functions";
import type { Database } from "@/integrations/supabase/types";

export async function frontendAdminCreateUser(data: {
  fullName: string;
  username: string;
  password?: string;
  role: "admin" | "user";
  status: "Active" | "Inactive";
}) {
  const username = data.username.trim().toLowerCase();
  if (!username || !data.password || data.password.length < 4) {
    throw new Error("Username and a password of at least 4 characters are required");
  }

  // 1. Check for duplicates using the admin's existing authenticated client
  const { data: dupe } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (dupe) throw new Error("That username is already taken");

  // 2. Create a temporary Supabase client that does not persist session
  // This allows us to use signUp to create an Auth user without logging out the current Admin
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase configuration");
  }

  const tempClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 3. Create the user in Supabase Auth
  // Note: If email confirmations are enabled in Supabase, the user won't be able to log in
  // until confirmed, but this is the only way to create users from a static frontend.
  const { data: authData, error: authError } = await tempClient.auth.signUp({
    email: usernameToEmail(username),
    password: authPassword(data.password),
  });

  if (authError) {
    throw new Error(`Could not create the auth account: ${authError.message}`);
  }
  if (!authData.user) {
    throw new Error("Account creation failed, no user returned");
  }

  const userId = authData.user.id;

  // 4. Insert profile using the primary (admin) client so RLS allows it
  const { error: profErr } = await supabase.from("profiles").insert({
    id: userId,
    full_name: data.fullName.trim(),
    username,
    role: data.role,
    status: data.status,
    must_change_password: false,
  });

  if (profErr) {
    throw new Error(`Could not save the user profile: ${profErr.message}`);
  }

  // 5. Insert role
  const { error: roleErr } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: data.role,
  });

  if (roleErr) {
    // If role fails, try to cleanup profile (Auth user cannot be deleted from frontend)
    await supabase.from("profiles").delete().eq("id", userId);
    throw new Error(`Could not save the user role: ${roleErr.message}`);
  }

  return { id: userId };
}
