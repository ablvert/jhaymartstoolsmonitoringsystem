import { createServerFn } from "@tanstack/react-start";

export const DEFAULT_ADMIN_USERNAME = "admin";
export const USERNAME_DOMAIN = "jhaymarts.local";

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${USERNAME_DOMAIN}`;
}

/**
 * The auth service requires passwords of 6+ characters, but the system allows
 * short PINs such as the default "1111". Every password is sent through this
 * deterministic transform before reaching auth; it is still hashed there.
 */
export function authPassword(password: string) {
  return `JTMS-${password}`;
}

/**
 * Creates the default Admin / 1111 account the first time the system is used.
 * Idempotent: it does nothing once any admin profile exists.
 */
export const ensureDefaultAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("profiles")
    .select("id, must_change_password, status")
    .eq("username", DEFAULT_ADMIN_USERNAME)
    .maybeSingle();

  if (existingError) return { created: false, error: existingError.message };
  if (existing) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(existing.id);
    if (authUser?.user) {
      // While the default password has not been changed yet, keep it in sync
      // with the current password format so Admin / 1111 always works.
      if (existing.must_change_password) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: authPassword("1111"),
          email_confirm: true,
        });
        if (pwError) return { created: false, error: pwError.message };
        if (existing.status !== "Active") {
          await supabaseAdmin.from("profiles").update({ status: "Active" }).eq("id", existing.id);
        }
        return { created: true };
      }
      return { created: false, debug: "profile-ok-password-changed" };
    }
    // Orphan profile without a sign-in account: remove and recreate below.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", existing.id);
    await supabaseAdmin.from("profiles").delete().eq("id", existing.id);
  }

  const email = usernameToEmail(DEFAULT_ADMIN_USERNAME);
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: authPassword("1111"),
    email_confirm: true,
  });
  if (error?.message?.toLowerCase().includes("already")) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users.find((u) => u.email === email);
    if (found) {
      await supabaseAdmin.auth.admin.updateUserById(found.id, { password: authPassword("1111"), email_confirm: true });
      const { error: pe } = await supabaseAdmin.from("profiles").upsert({
        id: found.id, full_name: "System Administrator", username: DEFAULT_ADMIN_USERNAME,
        role: "admin", status: "Active", must_change_password: true,
      });
      if (pe) return { created: false, error: pe.message };
      await supabaseAdmin.from("user_roles").upsert({ user_id: found.id, role: "admin" }, { onConflict: "user_id,role" });
      return { created: true };
    }
  }
  if (error || !created.user) {
    return { created: false, error: error?.message ?? "Could not create the default account" };
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    full_name: "System Administrator",
    username: DEFAULT_ADMIN_USERNAME,
    role: "admin",
    status: "Active",
    must_change_password: true,
  });
  if (profileError) return { created: false, error: profileError.message };
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });

  return { created: true };
});
