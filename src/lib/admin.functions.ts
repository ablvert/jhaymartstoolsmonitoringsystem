import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authPassword, usernameToEmail } from "./bootstrap.functions";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Only administrators can perform this action");
}

type NewUser = {
  fullName: string;
  username: string;
  password: string;
  role: "admin" | "user";
  status: "Active" | "Inactive";
};

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NewUser) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const username = data.username.trim().toLowerCase();
    if (!username || !data.password || data.password.length < 4) {
      throw new Error("Username and a password of at least 4 characters are required");
    }

    const { data: dupe } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (dupe) throw new Error("That username is already taken");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: authPassword(data.password),
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      full_name: data.fullName.trim(),
      username,
      role: data.role === "admin" ? "admin" : "user",
      status: data.status === "Inactive" ? "Inactive" : "Active",
      must_change_password: false,
    });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(`Could not save the user profile: ${profErr.message}`);
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role === "admin" ? "admin" : "user" });
    if (roleErr) {
      await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(`Could not save the user role: ${roleErr.message}`);
    }

    return { id: created.user.id };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      fullName: string;
      username: string;
      role: "admin" | "user";
      status: "Active" | "Inactive";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const username = data.username.trim().toLowerCase();
    const { data: dupe } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", data.id)
      .maybeSingle();
    if (dupe) throw new Error("That username is already taken");

    if (data.role !== "admin" || data.status !== "Active") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "Active")
        .neq("id", data.id);
      if (!count) throw new Error("The last active administrator cannot be demoted or deactivated");
    }

    await supabaseAdmin.auth.admin.updateUserById(data.id, { email: usernameToEmail(username) });
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        username,
        role: data.role,
        status: data.status,
      })
      .eq("id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });

    return { ok: true };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (!data.password || data.password.length < 4) {
      throw new Error("The password must be at least 4 characters");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: authPassword(data.password),
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.id === (context as any).userId) {
      throw new Error("You cannot delete the account you are signed in with");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "Active")
      .neq("id", data.id);
    if (!count) throw new Error("The last active administrator cannot be deleted");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);
    await supabaseAdmin.auth.admin.deleteUser(data.id);
    return { ok: true };
  });

export const adminDeleteAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tool_returns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("tool_transfers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("tools").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });

type BackupPayload = {
  departments: any[];
  areas: any[];
  tools: any[];
  tool_transfers: any[];
  tool_returns: any[];
};

export const adminRestoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { backup: BackupPayload }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const b = data.backup;
    if (!b || !Array.isArray(b.tools)) throw new Error("The backup file is not valid");

    const wipe = "00000000-0000-0000-0000-000000000000";
    await supabaseAdmin.from("tool_returns").delete().neq("id", wipe);
    await supabaseAdmin.from("tool_transfers").delete().neq("id", wipe);
    await supabaseAdmin.from("tools").delete().neq("id", wipe);
    await supabaseAdmin.from("departments").delete().neq("id", wipe);
    await supabaseAdmin.from("areas").delete().neq("id", wipe);

    if (b.departments?.length) await supabaseAdmin.from("departments").insert(b.departments);
    if (b.areas?.length) await supabaseAdmin.from("areas").insert(b.areas);
    if (b.tools?.length) await supabaseAdmin.from("tools").insert(b.tools);
    if (b.tool_transfers?.length) await supabaseAdmin.from("tool_transfers").insert(b.tool_transfers);
    if (b.tool_returns?.length) await supabaseAdmin.from("tool_returns").insert(b.tool_returns);

    return {
      restored: {
        departments: b.departments?.length ?? 0,
        areas: b.areas?.length ?? 0,
        tools: b.tools.length,
        transfers: b.tool_transfers?.length ?? 0,
        returns: b.tool_returns?.length ?? 0,
      },
    };
  });
