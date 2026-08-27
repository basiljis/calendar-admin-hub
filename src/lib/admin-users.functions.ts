import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "manager" | "employee";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Недостаточно прав: требуется роль администратора");
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("full_name"),
      supabaseAdmin.from("user_roles").select("*"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    return (profiles ?? []).map((p: any) => ({
      id: p.id as string,
      full_name: (p.full_name as string) || "Без имени",
      email: (p.email as string | null) ?? null,
      phone: (p.phone as string | null) ?? null,
      position: (p.position as string | null) ?? null,
      shift_group: (p.shift_group as number) ?? 1,
      created_at: p.created_at as string,
      roles: (roles ?? [])
        .filter((r: any) => r.user_id === p.id)
        .map((r: any) => r.role as AppRole),
    }));
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        roles: z.array(z.enum(["admin", "manager", "employee"])).min(1),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.roles.includes("admin")) {
      throw new Error("Нельзя снять с себя роль администратора");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: data.userId, role })));
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export const bulkSetRole = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(200),
        role: z.enum(["admin", "manager", "employee"]),
        action: z.enum(["assign", "revoke"]),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    // Права проверяются на сервере для КАЖДОГО изменения, а не один раз на пакет.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

    for (const userId of data.userIds) {
      try {
        await assertAdmin(context);

        if (data.action === "revoke") {
          if (userId === context.userId && data.role === "admin") {
            throw new Error("Нельзя снять с себя роль администратора");
          }
          const { data: current, error: curErr } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (curErr) throw new Error(curErr.message);
          const remaining = (current ?? []).filter((r: any) => r.role !== data.role);
          if ((current ?? []).length > 0 && remaining.length === 0) {
            throw new Error("У пользователя должна остаться хотя бы одна роль");
          }
          const { error } = await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .eq("role", data.role);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
          if (error) throw new Error(error.message);
        }

        results.push({ userId, ok: true });
      } catch (e: any) {
        results.push({ userId, ok: false, error: e?.message ?? "Ошибка" });
      }
    }

    return {
      ok: results.every((r) => r.ok),
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });

export const updateUserProfileAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        full_name: z.string().min(1).max(120),
        phone: z.string().max(40).nullable(),
        position: z.string().max(120).nullable(),
        shift_group: z.number().int().min(1).max(2),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone,
        position: data.position,
        shift_group: data.shift_group,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUserDetailAdmin = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: profile, error: pErr },
      { data: roles, error: rErr },
      { data: shifts, error: sErr },
      { data: vacations, error: vErr },
      { data: notifications, error: nErr },
      { data: auditLogs, error: aErr },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).single(),
      supabaseAdmin.from("user_roles").select("*").eq("user_id", data.userId),
      supabaseAdmin
        .from("shifts")
        .select("*")
        .eq("user_id", data.userId)
        .order("work_date", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("vacations")
        .select("*")
        .eq("user_id", data.userId)
        .order("start_date", { ascending: false }),
      supabaseAdmin
        .from("notifications")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("vacation_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (pErr) throw new Error("Пользователь не найден");
    if (rErr) throw new Error(rErr.message);
    if (sErr) throw new Error(sErr.message);
    if (vErr) throw new Error(vErr.message);
    if (nErr) throw new Error(nErr.message);
    if (aErr) throw new Error(aErr.message);

    const vacationIds = new Set((vacations ?? []).map((v: any) => v.id));
    const audit = (auditLogs ?? []).filter((l: any) => vacationIds.has(l.vacation_id));

    // Актёр действий аудита
    const actorIds = [...new Set(audit.map((l: any) => l.action_by as string))];
    const { data: actors } = actorIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] };
    const actorName = new Map((actors ?? []).map((a: any) => [a.id as string, a.full_name as string]));

    return {
      profile: {
        id: profile.id as string,
        full_name: (profile.full_name as string) || "",
        email: (profile.email as string | null) ?? null,
        phone: (profile.phone as string | null) ?? null,
        position: (profile.position as string | null) ?? null,
        shift_group: (profile.shift_group as number) ?? 1,
        created_at: profile.created_at as string,
      },
      roles: (roles ?? []).map((r: any) => r.role as AppRole),
      shifts: shifts ?? [],
      vacations: vacations ?? [],
      notifications: notifications ?? [],
      audit: audit.map((l: any) => ({
        id: l.id as string,
        vacation_id: l.vacation_id as string,
        action_type: l.action_type as string,
        previous_status: (l.previous_status as string | null) ?? null,
        new_status: (l.new_status as string | null) ?? null,
        created_at: l.created_at as string,
        actor: actorName.get(l.action_by as string) ?? "Неизвестно",
      })),
    };
  });

export const createUserAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      full_name: z.string().min(1).max(120),
      role: z.enum(["admin", "manager", "employee"]),
      phone: z.string().max(40).nullable(),
      position: z.string().max(120).nullable(),
      shift_group: z.number().int().min(1).max(2),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isManager } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "manager",
    });
    if (!isAdmin && !isManager) throw new Error("Недостаточно прав для добавления пользователя");
    if (!isAdmin && data.role !== "employee") {
      throw new Error("Руководитель может добавлять только сотрудников");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Предварительная проверка: пользователь с таким email уже существует?
    const email = data.email.trim().toLowerCase();
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingProfile) {
      throw new Error("Пользователь с таким email уже существует");
    }
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailTaken = (usersPage?.users ?? []).some(
      (u: any) => (u.email ?? "").toLowerCase() === email,
    );
    if (emailTaken) {
      throw new Error("Пользователь с таким email уже зарегистрирован");
    }

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        position: data.position,
        shift_group: String(data.shift_group),
        role: data.role,
        approved_by_admin: "true",
      },
    });
    if (authError || !created.user) {
      const msg = authError?.message ?? "Не удалось создать пользователя";
      if (/already|exists|duplicate/i.test(msg)) {
        throw new Error("Пользователь с таким email уже зарегистрирован");
      }
      throw new Error(msg);
    }

    // Идемпотентно: профиль и роль приводятся к нужному состоянию независимо
    // от того, сработал ли триггер handle_new_user и сколько раз вызван сценарий.
    const profilePayload = {
      id: created.user.id,
      email,
      full_name: data.full_name,
      phone: data.phone,
      position: data.position,
      shift_group: data.shift_group,
      is_approved: true,
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    // Нужная роль добавляется идемпотентно, лишние роли удаляются.
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleError.message);
    }

    const { error: roleCleanupError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", created.user.id)
      .neq("role", data.role);
    if (roleCleanupError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleCleanupError.message);
    }


    return { ok: true, userId: created.user.id };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Нельзя удалить собственную учетную запись");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
    ]);
    if (!isAdmin && !isManager) {
      throw new Error("Недостаточно прав для изменения статуса учётной записи");
    }
    if (data.userId === context.userId && !data.active) {
      throw new Error("Нельзя деактивировать собственную учётную запись");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!isAdmin) {
      const { data: targetRoles, error: rErr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId);
      if (rErr) throw new Error(rErr.message);
      const isTargetPrivileged = (targetRoles ?? []).some(
        (r: any) => r.role === "admin" || r.role === "manager",
      );
      if (isTargetPrivileged) {
        throw new Error("Руководитель может менять статус только сотрудников");
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    // Блокируем/разблокируем вход в систему, не удаляя учётную запись
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    } as any);

    return { ok: true, active: data.active };
  });

export const setUserApproved = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        approved: z.boolean(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
    ]);
    if (!isAdmin && !isManager) {
      throw new Error("Недостаточно прав для подтверждения пользователя");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_approved: data.approved })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      title: data.approved ? "Учётная запись подтверждена" : "Подтверждение отозвано",
      message: data.approved
        ? "Ваша регистрация подтверждена. Доступ к системе открыт."
        : "Доступ к системе приостановлен до повторного подтверждения.",
      type: "system",
    });

    return { ok: true, approved: data.approved };
  });
