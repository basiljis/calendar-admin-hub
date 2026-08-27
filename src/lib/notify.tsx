import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type NotifyLevel = "success" | "error" | "warning" | "info";

export interface NotifyItem {
  id: number;
  level: NotifyLevel;
  title: string;
  description?: string | undefined;
  action?: { label: string; onClick: () => void } | undefined;
}

// ---- Перевод типовых системных сообщений на русский язык ----
const exactRu: Record<string, string> = {
  "invalid login credentials": "Неверный email или пароль",
  "email not confirmed": "Email не подтверждён",
  "user already registered": "Пользователь с таким email уже зарегистрирован",
  "invalid email or password": "Неверный email или пароль",
  "failed to fetch": "Нет связи с сервером. Проверьте подключение к интернету",
  "network error": "Ошибка сети. Попробуйте позже",
  unauthorized: "Недостаточно прав для выполнения операции",
  "not found": "Данные не найдены",
};

const partialRu: [RegExp, string][] = [
  [/password should be at least (\d+)/i, "Пароль должен содержать не менее $1 символов"],
  [/password.*at least (\d+) characters/i, "Пароль должен содержать не менее $1 символов"],
  [/unable to validate email address/i, "Некорректный адрес электронной почты"],
  [/email address .* is invalid/i, "Некорректный адрес электронной почты"],
  [/user not found/i, "Пользователь не найден"],
  [/rate limit|too many requests/i, "Слишком много попыток. Повторите позже"],
  [/banned|disabled/i, "Учётная запись отключена. Обратитесь к администратору"],
  [/duplicate key value/i, "Такая запись уже существует"],
  [/violates row-level security|permission denied/i, "Недостаточно прав для выполнения операции"],
  [/jwt|token .*expired|session .*expired/i, "Сессия истекла. Войдите заново"],
  [/failed to fetch|networkerror/i, "Нет связи с сервером. Проверьте подключение к интернету"],
  [/timeout/i, "Превышено время ожидания ответа сервера"],
  [/invalid input syntax/i, "Некорректный формат введённых данных"],
  [/required/i, "Заполните обязательные поля"],
];

export function translateMessage(input: unknown): string {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const text = raw.trim();
  if (!text) return "Произошла ошибка";
  // Текст уже на русском — оставляем как есть
  if (/[А-Яа-яЁё]/.test(text)) return text;
  const exact = exactRu[text.toLowerCase().replace(/[.!]$/, "")];
  if (exact) return exact;
  for (const [re, ru] of partialRu) {
    if (re.test(text)) return text.replace(re, ru);
  }
  return text;
}

// ---- Хранилище очереди модальных уведомлений ----
let items: NotifyItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeNotifications(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getNotifications() {
  return items;
}

export function dismissNotification(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

type Options =
  | { description?: string; action?: { label: string; onClick: () => void } }
  | string
  | undefined;

function push(level: NotifyLevel, title: unknown, options?: Options) {
  const description =
    typeof options === "string" ? options : options?.description;
  const action = typeof options === "string" ? undefined : options?.action;
  const item: NotifyItem = {
    id: ++seq,
    level,
    title: translateMessage(
      title instanceof Error ? title.message : title,
    ),
    description: description ? translateMessage(description) : undefined,
    action,
  };
  items = [...items, item];
  emit();
  return item.id;
}

/** Совместимый с sonner API, но уведомления показываются модальными окнами. */
export const toast = Object.assign(
  (title: unknown, options?: Options) => push("info", title, options),
  {
    success: (title: unknown, options?: Options) => push("success", title, options),
    error: (title: unknown, options?: Options) => push("error", title, options),
    warning: (title: unknown, options?: Options) => push("warning", title, options),
    info: (title: unknown, options?: Options) => push("info", title, options),
    message: (title: unknown, options?: Options) => push("info", title, options),
    dismiss: (id?: number) => {
      if (typeof id === "number") dismissNotification(id);
      else {
        items = [];
        emit();
      }
    },
  },
);

const levelConfig: Record<
  NotifyLevel,
  { icon: typeof Info; label: string; wrap: string }
> = {
  success: {
    icon: CheckCircle2,
    label: "Готово",
    wrap: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  error: { icon: XCircle, label: "Ошибка", wrap: "bg-destructive/12 text-destructive" },
  warning: {
    icon: AlertTriangle,
    label: "Внимание",
    wrap: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  info: { icon: Info, label: "Уведомление", wrap: "bg-primary/12 text-primary" },
};

/** Глобальный хост модальных уведомлений. Монтируется один раз в корне. */
export function NotificationModals() {
  const [list, setList] = useState<NotifyItem[]>([]);

  useEffect(() => {
    setList(getNotifications());
    return subscribeNotifications(() => setList([...getNotifications()]));
  }, []);

  const current = list[0];
  if (!current) return null;

  const cfg = levelConfig[current.level];
  const Icon = cfg.icon;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismissNotification(current.id);
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            className={`mb-2 flex size-12 items-center justify-center rounded-full ${cfg.wrap}`}
          >
            <Icon className="size-6" />
          </span>
          <DialogTitle className="text-base">{cfg.label}</DialogTitle>
          <DialogDescription className="text-sm text-foreground">
            {current.title}
          </DialogDescription>
          {current.description && (
            <DialogDescription className="text-xs">
              {current.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          {current.action && (
            <Button
              variant="outline"
              className="min-w-28"
              onClick={() => {
                current.action?.onClick();
                dismissNotification(current.id);
              }}
            >
              {current.action.label}
            </Button>
          )}
          <Button className="min-w-28" onClick={() => dismissNotification(current.id)}>
            Понятно
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
