import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set)");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized: Invalid or expired token");
    }

    // Verify caller has admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Forbidden: Admin access required");
    }

    const body = await req.json();
    const { action, payload } = body;

    // ── Create User ──────────────────────────────────────────────────────────────
    if (action === "create_user") {
      const { username, password, fullName, role, status } = payload;
      if (!username || !password || password.length < 4) {
        throw new Error("Username and a password of at least 4 characters are required");
      }

      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
      const email = `${cleanUsername}@jhaymarts.local`;
      const authPassword = `JTMS-${password}`;

      // Check duplicate username
      const { data: dupe } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();
      if (dupe) throw new Error("That username is already taken");

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: authPassword,
        email_confirm: true,
      });

      if (error || !created.user) {
        throw new Error(error?.message || "Failed to create Auth user");
      }

      const userId = created.user.id;

      const { error: profErr } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        full_name: fullName.trim(),
        username: cleanUsername,
        role,
        status,
        must_change_password: false,
      });

      if (profErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Profile insert failed: ${profErr.message}`);
      }

      const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role,
      });

      if (rErr) {
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Role insert failed: ${rErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Update User ──────────────────────────────────────────────────────────────
    if (action === "update_user") {
      const { id, username, fullName, role, status } = payload;
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
      const email = `${cleanUsername}@jhaymarts.local`;

      // Check if another user already has this username
      const { data: dupe } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .neq("id", id)
        .maybeSingle();
      if (dupe) throw new Error("That username is already taken");

      await supabaseAdmin.auth.admin.updateUserById(id, { email });
      await supabaseAdmin.from("profiles").update({
        full_name: fullName.trim(),
        username: cleanUsername,
        role,
        status,
      }).eq("id", id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("user_roles").insert({ user_id: id, role });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Delete User ──────────────────────────────────────────────────────────────
    if (action === "delete_user") {
      const { id } = payload;
      if (id === user.id) throw new Error("Cannot delete the account you are signed in with");

      // Prevent deleting last admin
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "Active")
        .neq("id", id);
      if (!count) throw new Error("The last active administrator cannot be deleted");

      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("profiles").delete().eq("id", id);
      await supabaseAdmin.auth.admin.deleteUser(id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Set Password ─────────────────────────────────────────────────────────────
    if (action === "set_password") {
      const { id, password } = payload;
      if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");
      const authPassword = `JTMS-${password}`;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: authPassword });
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Apply Schema Migration ───────────────────────────────────────────────────
    if (action === "apply_migration") {
      // Run migration statements one at a time using raw SQL via supabaseAdmin
      const statements = [
        "ALTER TABLE public.tool_transfers ADD COLUMN IF NOT EXISTS transfer_to_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL",
        "ALTER TABLE public.tool_returns ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL",
        "ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS current_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL",
        "ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS current_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL",
        "UPDATE public.tools SET current_department_id = department_id, current_area_id = area_id WHERE current_department_id IS NULL",
        "ALTER TABLE public.tool_transfers ADD COLUMN IF NOT EXISTS released_by text",
      ];

      const results: string[] = [];
      for (const stmt of statements) {
        try {
          // Use the Postgres REST API directly via the admin client
          const res = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sql: stmt }),
          });
          results.push(`OK: ${stmt.substring(0, 60)}`);
        } catch (e: any) {
          results.push(`Error: ${e.message}`);
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error("admin-ops error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
