import { supabase } from "@/integrations/supabase/client";

export async function frontendAdminCreateUser(data: {
  fullName: string;
  username: string;
  password?: string;
  role: "admin" | "user";
  status: "Active" | "Inactive";
}) {
  const { data: result, error } = await supabase.functions.invoke("admin-ops", {
    body: {
      action: "create_user",
      payload: data,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to call admin Edge Function");
  }

  if (result?.error) {
    throw new Error(result.error);
  }

  return { id: result.id };
}

export async function frontendAdminUpdateUser(data: {
  id: string;
  fullName: string;
  username: string;
  role: "admin" | "user";
  status: "Active" | "Inactive";
}) {
  const { data: result, error } = await supabase.functions.invoke("admin-ops", {
    body: {
      action: "update_user",
      payload: data,
    },
  });

  if (error) throw new Error(error.message);
  if (result?.error) throw new Error(result.error);
  return { ok: true };
}

export async function frontendAdminSetPassword(data: { id: string; password: string }) {
  const { data: result, error } = await supabase.functions.invoke("admin-ops", {
    body: {
      action: "set_password",
      payload: data,
    },
  });

  if (error) throw new Error(error.message);
  if (result?.error) throw new Error(result.error);
  return { ok: true };
}

export async function frontendAdminDeleteUser(data: { id: string }) {
  const { data: result, error } = await supabase.functions.invoke("admin-ops", {
    body: {
      action: "delete_user",
      payload: data,
    },
  });

  if (error) throw new Error(error.message);
  if (result?.error) throw new Error(result.error);
  return { ok: true };
}
