import { supabase } from "@/integrations/supabase/client";

/** Calls the admin-ops backend function and surfaces its real error message. */
async function callAdminOps<T = any>(action: string, payload: unknown): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke("admin-ops", {
    body: { action, payload },
  });

  if (error) {
    // Non-2xx responses: read the JSON body for the actual reason.
    let message = error.message || "Admin request failed";
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.clone().json();
        if (body?.error) message = body.error;
      } catch {
        /* keep original message */
      }
    }
    throw new Error(message);
  }
  if (result?.error) throw new Error(result.error);
  return result as T;
}

export async function frontendAdminCreateUser(data: {
  fullName: string;
  username: string;
  password?: string;
  role: "admin" | "user";
  status: "Active" | "Inactive";
}) {
  const result = await callAdminOps<{ id: string }>("create_user", data);
  return { id: result.id };
}

export async function frontendAdminUpdateUser(data: {
  id: string;
  fullName: string;
  username: string;
  role: "admin" | "user";
  status: "Active" | "Inactive";
}) {
  await callAdminOps("update_user", data);
  return { ok: true };
}

export async function frontendAdminSetPassword(data: { id: string; password: string }) {
  await callAdminOps("set_password", data);
  return { ok: true };
}

export async function frontendAdminDeleteUser(data: { id: string }) {
  await callAdminOps("delete_user", data);
  return { ok: true };
}
