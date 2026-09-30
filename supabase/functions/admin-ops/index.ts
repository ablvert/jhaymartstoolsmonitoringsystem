import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
      throw new Error("Missing Supabase configuration");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Forbidden: Admin access required");
    }

    const { action, payload } = await req.json();

    if (action === "create_user") {
      const { username, password, fullName, role, status } = payload;
      
      const email = `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@jhaymarts.local`;
      const authPassword = `JTMS-${password}`;

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
        username: username.trim().toLowerCase(),
        role,
        status,
        must_change_password: false,
      });

      if (profErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Profile error: ${profErr.message}`);
      }

      const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role,
      });

      if (rErr) {
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Role error: ${rErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update_user") {
      const { id, username, fullName, role, status } = payload;
      const email = `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@jhaymarts.local`;

      await supabaseAdmin.auth.admin.updateUserById(id, { email });
      await supabaseAdmin.from("profiles").update({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
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

    if (action === "delete_user") {
      const { id } = payload;
      if (id === user.id) throw new Error("Cannot delete your own account");

      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("profiles").delete().eq("id", id);
      await supabaseAdmin.auth.admin.deleteUser(id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    if (action === "set_password") {
      const { id, password } = payload;
      const authPassword = `JTMS-${password}`;
      await supabaseAdmin.auth.admin.updateUserById(id, { password: authPassword });
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Unknown action");

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
