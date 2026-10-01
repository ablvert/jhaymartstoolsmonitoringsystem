import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toEmail = (u: string) => `${u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@jhaymarts.local`;
const toAuthPassword = (p: string) => `JTMS-${p}`;
const cleanRole = (r: unknown) => (r === "admin" ? "admin" : "user");
const cleanStatus = (s: unknown) => (s === "Inactive" ? "Inactive" : "Active");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) throw new HttpError(500, "Server misconfigured: SUPABASE_URL is missing");
    if (!serviceKey) throw new HttpError(500, "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller session
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new HttpError(401, "Not signed in: missing Authorization header");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) {
      throw new HttpError(401, `Session invalid: ${authError?.message ?? "no user"}`);
    }
    const caller = userData.user;

    // Verify caller is admin
    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    if (roleError) throw new HttpError(500, `Role lookup failed: ${roleError.message}`);
    if (!roleRows || roleRows.length === 0) throw new HttpError(403, "Only administrators can manage users");

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "Invalid request body");
    }
    const { action, payload } = body ?? {};
    if (!payload || typeof payload !== "object") throw new HttpError(400, "Missing payload");

    if (action === "create_user") {
      const fullName = String(payload.fullName ?? "").trim();
      const username = String(payload.username ?? "").trim().toLowerCase();
      const password = String(payload.password ?? "");
      const role = cleanRole(payload.role);
      const status = cleanStatus(payload.status);

      if (!fullName) throw new HttpError(400, "Full name is required");
      if (!username || !/^[a-z0-9._-]+$/.test(username)) {
        throw new HttpError(400, "Username may only contain letters, numbers, dots, dashes and underscores");
      }
      if (password.length < 4) throw new HttpError(400, "Password must be at least 4 characters");

      const { data: dupe, error: dupeErr } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (dupeErr) throw new HttpError(500, `Username check failed: ${dupeErr.message}`);
      if (dupe) throw new HttpError(409, "Username already exists.");

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: toEmail(username),
        password: toAuthPassword(password),
        email_confirm: true,
        user_metadata: { full_name: fullName, username },
      });
      if (createErr || !created?.user) {
        const msg = createErr?.message ?? "unknown error";
        if (/already/i.test(msg)) throw new HttpError(409, "Username already exists.");
        throw new HttpError(400, `Could not create the auth account: ${msg}`);
      }
      const userId = created.user.id;

      const { error: profErr } = await admin.from("profiles").insert({
        id: userId,
        full_name: fullName,
        username,
        role,
        status,
        must_change_password: false,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(userId);
        throw new HttpError(400, `Could not save the user profile: ${profErr.message}`);
      }

      const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (rErr) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        throw new HttpError(400, `Could not save the user role: ${rErr.message}`);
      }

      await admin.from("activity_logs").insert({
        user_id: caller.id,
        action: "Created user",
        details: `${fullName} (${username}) as ${role}`,
      });

      return json({ success: true, message: "User created successfully", id: userId });
    }

    if (action === "update_user") {
      const id = String(payload.id ?? "");
      const fullName = String(payload.fullName ?? "").trim();
      const username = String(payload.username ?? "").trim().toLowerCase();
      const role = cleanRole(payload.role);
      const status = cleanStatus(payload.status);
      if (!id || !fullName || !username) throw new HttpError(400, "Missing user details");

      const { data: dupe } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", id)
        .maybeSingle();
      if (dupe) throw new HttpError(409, "Username already exists.");

      const { error: eErr } = await admin.auth.admin.updateUserById(id, { email: toEmail(username) });
      if (eErr) throw new HttpError(400, `Could not update the auth account: ${eErr.message}`);
      const { error: pErr } = await admin
        .from("profiles")
        .update({ full_name: fullName, username, role, status })
        .eq("id", id);
      if (pErr) throw new HttpError(400, `Could not update the profile: ${pErr.message}`);
      await admin.from("user_roles").delete().eq("user_id", id);
      const { error: rErr } = await admin.from("user_roles").insert({ user_id: id, role });
      if (rErr) throw new HttpError(400, `Could not update the role: ${rErr.message}`);

      return json({ success: true, message: "User updated" });
    }

    if (action === "delete_user") {
      const id = String(payload.id ?? "");
      if (!id) throw new HttpError(400, "Missing user id");
      if (id === caller.id) throw new HttpError(400, "You cannot delete the account you are signed in with");

      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("profiles").delete().eq("id", id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new HttpError(400, `Could not delete the auth account: ${error.message}`);
      return json({ success: true, message: "User deleted" });
    }

    if (action === "set_password") {
      const id = String(payload.id ?? "");
      const password = String(payload.password ?? "");
      if (!id) throw new HttpError(400, "Missing user id");
      if (password.length < 4) throw new HttpError(400, "Password must be at least 4 characters");
      const { error } = await admin.auth.admin.updateUserById(id, { password: toAuthPassword(password) });
      if (error) throw new HttpError(400, `Could not change the password: ${error.message}`);
      await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
      return json({ success: true, message: "Password changed" });
    }

    throw new HttpError(400, `Unknown action: ${action}`);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin-ops error:", status, message);
    return json({ success: false, error: message }, status);
  }
});
