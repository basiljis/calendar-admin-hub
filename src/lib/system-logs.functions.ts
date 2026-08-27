import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const levelSchema = z.enum(["info", "warning", "error"]);
const categorySchema = z.enum(["auth", "error", "system", "action"]);

/** Публичная запись события: вход в систему и клиентские сбои (сессии может не быть). */
export const logSystemEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        level: levelSchema.default("info"),
        category: categorySchema.default("system"),
        event: z.string().min(1).max(120),
        message: z.string().max(4000).default(""),
        userEmail: z.string().max(255).nullable().default(null),
        userId: z.string().uuid().nullable().default(null),
        context: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = getRequestHeader("user-agent")?.slice(0, 400) ?? null;

    const { error } = await supabaseAdmin.from("system_logs").insert({
      level: data.level,
      category: data.category,
      event: data.event,
      message: data.message,
      user_id: data.userId,
      user_email: data.userEmail ? data.userEmail.toLowerCase() : null,
      context: data.context as any,
      ip_address: ip,
      user_agent: userAgent,
    });
    if (error) {
      // Логирование не должно ломать пользовательский сценарий
      console.error("system_logs insert failed:", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

/** Чтение журнала — только администратор и руководитель. */
export const listSystemLogs = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        category: z.enum(["all", "auth", "error", "system", "action"]).default("all"),
        level: z.enum(["all", "info", "warning", "error"]).default("all"),
        search: z.string().max(120).default(""),
        limit: z.number().int().min(10).max(500).default(200),
      })
      .parse(data ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
    ]);
    if (!isAdmin && !isManager) throw new Error("Недостаточно прав для просмотра журнала");

    let query = context.supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.category !== "all") query = query.eq("category", data.category);
    if (data.level !== "all") query = query.eq("level", data.level);
    if (data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      query = query.or(`event.ilike.${s},message.ilike.${s},user_email.ilike.${s}`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      level: r.level as z.infer<typeof levelSchema>,
      category: r.category as z.infer<typeof categorySchema>,
      event: r.event as string,
      message: (r.message as string) ?? "",
      user_email: (r.user_email as string | null) ?? null,
      ip_address: (r.ip_address as string | null) ?? null,
      user_agent: (r.user_agent as string | null) ?? null,
      context: (r.context as Record<string, unknown>) ?? {},
      created_at: r.created_at as string,
    }));
  });

/** Очистка журнала старше N дней — только администратор. */
export const purgeSystemLogs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ olderThanDays: z.number().int().min(0).max(365).default(30) }).parse(data ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Очистка журнала доступна только администратору");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - data.olderThanDays * 86_400_000).toISOString();
    const { error } = await supabaseAdmin.from("system_logs").delete().lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
