import { logSystemEvent } from "@/lib/system-logs.functions";

type LogInput = {
  level?: "info" | "warning" | "error";
  category?: "auth" | "error" | "system" | "action";
  event: string;
  message?: string;
  userEmail?: string | null;
  userId?: string | null;
  context?: Record<string, string>;
};

/** Отправка события в журнал. Никогда не бросает исключений. */
export function recordEvent(input: LogInput) {
  const payload = {
    level: input.level ?? "info",
    category: input.category ?? "system",
    event: input.event,
    message: input.message ?? "",
    userEmail: input.userEmail ?? null,
    userId: input.userId ?? null,
    context: input.context ?? {},
  };
  void logSystemEvent({ data: payload }).catch(() => {
    /* журнал не должен ломать работу приложения */
  });
}

let globalHandlersInstalled = false;

/** Глобальный перехват необработанных сбоев в браузере. */
export function installGlobalErrorLogging() {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (e) => {
    recordEvent({
      level: "error",
      category: "error",
      event: "Ошибка в интерфейсе",
      message: e.message || "Неизвестная ошибка",
      context: {
        source: `${e.filename ?? ""}:${e.lineno ?? 0}`,
        path: window.location.pathname,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = e.reason;
    recordEvent({
      level: "error",
      category: "error",
      event: "Необработанный сбой запроса",
      message: String(reason?.message ?? reason ?? "Неизвестная ошибка"),
      context: { path: window.location.pathname },
    });
  });
}
