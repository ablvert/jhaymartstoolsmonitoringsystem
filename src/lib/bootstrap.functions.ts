import { createServerFn } from "@tanstack/react-start";

export const DEFAULT_ADMIN_USERNAME = "admin";
export const USERNAME_DOMAIN = "jhaymarts.local";

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${USERNAME_DOMAIN}`;
}

/**
 * Creates the default Admin / 1111 account the first time the system is used.
 * Idempotent: it does nothing once any admin profile exists.
 */
export const ensureDefaultAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", DEFAULT_ADMIN_USERNAME)
    .maybeSingle();

  if (existing) return { created: false };

  const email = usernameToEmail(DEFAULT_ADMIN_USERNAME);
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "1111",
    email_confirm: true,
  });
  if (error || !created.user) {
    return { created: false, error: error?.message ?? "Could not create the default account" };
  }

  await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    full_name: "System Administrator",
    username: DEFAULT_ADMIN_USERNAME,
    role: "admin",
    status: "Active",
    must_change_password: true,
  });
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });

  return { created: true };
});
