import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is system_admin
    const authHeader = req.headers.get("Authorization")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["system_admin", "super_admin"]);

    const isSystemAdmin = (callerRoles || []).length > 0;
    const isSuperAdmin = (callerRoles || []).some((r: any) => r.role === "super_admin");

    if (!isSystemAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: system_admin only" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, userId } = body;

    if (action === "bootstrap_school") {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), { status: 403, headers: corsHeaders });
      }
      const { schoolName, classesPerGrade, managementEmail, managementFullName } = body;
      if (!schoolName || !managementEmail || !managementFullName) {
        return new Response(JSON.stringify({ error: "schoolName, managementEmail and managementFullName required" }), { status: 400, headers: corsHeaders });
      }

      // Run through the caller's own JWT so the DB-side super_admin check applies too.
      const { data: schoolId, error: bootstrapError } = await callerClient
        .rpc("bootstrap_school", { p_school_name: schoolName, p_classes_per_grade: classesPerGrade || 1 });
      if (bootstrapError) throw bootstrapError;

      const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
      const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
        email: managementEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: managementFullName },
      });
      if (createUserError) throw createUserError;

      await adminClient.from("profiles").update({
        full_name: managementFullName,
        school_id: schoolId,
        is_approved: true,
      }).eq("id", newUser.user.id);

      await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: "management" });

      await adminClient.from("system_audit_log").insert({
        school_id: schoolId,
        actor_id: caller.id,
        action: "school_created",
        details: { schoolName, managementEmail },
      });

      return new Response(JSON.stringify({
        success: true, schoolId, managementUserId: newUser.user.id, managementEmail, tempPassword,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "kill_switch") {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), { status: 403, headers: corsHeaders });
      }
      const { confirm } = body;
      if (confirm !== "השבת הכל") {
        return new Response(JSON.stringify({ error: "Confirmation phrase mismatch" }), { status: 400, headers: corsHeaders });
      }

      const { data: admins } = await adminClient.from("user_roles").select("user_id").in("role", ["system_admin", "super_admin"]);
      const adminIds = (admins || []).map((a: any) => a.user_id);

      const { data: affected, error } = await adminClient
        .from("profiles")
        .update({ is_approved: false })
        .not("id", "in", `(${adminIds.map((id: string) => `"${id}"`).join(",") || "''"})`)
        .select("id");
      if (error) throw error;

      await adminClient.from("system_audit_log").insert({
        actor_id: caller.id,
        action: "kill_switch_activated",
        details: { affected_count: affected?.length || 0 },
      });

      return new Response(JSON.stringify({ success: true, affectedCount: affected?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: corsHeaders });
    }

    if (action === "get_user") {
      const { data: authUser, error } = await adminClient.auth.admin.getUserById(userId);
      if (error) throw error;

      // Fetch activity summary
      const [messagesRes, attendanceRes, lessonsRes, submissionsRes, postsRes, notesRes] = await Promise.all([
        adminClient.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", userId),
        adminClient.from("attendance").select("id", { count: "exact", head: true }).eq("student_id", userId),
        adminClient.from("lessons").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
        adminClient.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", userId),
        adminClient.from("faction_posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
        adminClient.from("lesson_notes").select("id", { count: "exact", head: true }).eq("student_id", userId),
      ]);

      return new Response(JSON.stringify({
        email: authUser.user.email,
        created_at: authUser.user.created_at,
        last_sign_in_at: authUser.user.last_sign_in_at,
        activity: {
          messages: messagesRes.count || 0,
          attendance_records: attendanceRes.count || 0,
          lessons_taught: lessonsRes.count || 0,
          submissions: submissionsRes.count || 0,
          community_posts: postsRes.count || 0,
          lesson_notes: notesRes.count || 0,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_password") {
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: corsHeaders });
      }
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_roles") {
      const { roles } = body; // array of role strings
      if (!Array.isArray(roles)) {
        return new Response(JSON.stringify({ error: "roles must be an array" }), { status: 400, headers: corsHeaders });
      }
      if (roles.includes("super_admin") && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Only a super_admin can grant the super_admin role" }), { status: 403, headers: corsHeaders });
      }
      // Delete existing roles
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      // Insert new roles
      if (roles.length > 0) {
        const inserts = roles.map((role: string) => ({ user_id: userId, role }));
        const { error } = await adminClient.from("user_roles").insert(inserts);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user") {
      // Delete profile, roles, avatar, then auth user
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("avatars").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("id", userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
