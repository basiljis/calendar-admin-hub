import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { RefreshCw, Trash2, LogIn, AlertTriangle, Info, Activity, Layers, CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { listSystemLogs, purgeSystemLogs, resolveSystemLogs } from "@/lib/system-logs.functions";

const categoryLabels: Record<string, string> = {
  auth: "Входы",
  error: "Ошибки",
  system: "Система",
  action: "Действия",
};

const levelLabels: Record<string, string> = {
  info: "Информация",
  warning: "Предупреждение",
  error: "Ошибка",
};

function levelStyle(level: string) {
  if (level === "error") return "bg-destructive/15 text-destructive border-destructive/30";
  if (level === "warning") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-primary/10 text-primary border-primary/25";
}

function CategoryIcon({ category }: { category: string }) {
  if (category === "auth") return <LogIn className="size-4" aria-hidden="true" />;
  if (category === "error") return <AlertTriangle className="size-4" aria-hidden="true" />;
  if (category === "action") return <Activity className="size-4" aria-hidden="true" />;
  return <Info className="size-4" aria-hidden="true" />;
}

export function SystemLogsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const fetchLogs = useServerFn(listSystemLogs);
  const purge = useServerFn(purgeSystemLogs);
  const resolve = useServerFn(resolveSystemLogs);

  const [category, setCategory] = useState<"all" | "auth" | "error" | "system" | "action">("all");
  const [level, setLevel] = useState<"all" | "info" | "warning" | "error">("all");
  const [search, setSearch] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [hideResolved, setHideResolved] = useState(true);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["system-logs", category, level, search],
    queryFn: () => fetchLogs({ data: { category, level, search, limit: 200 } }),
    refetchInterval: 60_000,
  });

  const purgeMutation = useMutation({
    mutationFn: () => purge({ data: { olderThanDays: 30 } }),
    onSuccess: () => {
      toast.success("Записи старше 30 дней удалены");
      qc.invalidateQueries({ queryKey: ["system-logs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось очистить журнал"),
  });

  const resolveMutation = useMutation({
    mutationFn: (input: {
      level: "info" | "warning" | "error";
      category: "auth" | "error" | "system" | "action";
      event: string;
      message: string;
      resolved: boolean;
    }) => resolve({ data: input }),
    onSuccess: (_d, v) => {
      toast.success(v.resolved ? "Отмечено как исправленное" : "Отметка об исправлении снята");
      qc.invalidateQueries({ queryKey: ["system-logs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось обновить отметку"),
  });

  const logs = data ?? [];

  const allEntries = grouped
    ? Array.from(
        logs
          .reduce((acc, log) => {
            const key = `${log.level}|${log.category}|${log.event}|${log.message}`;
            const prev = acc.get(key);
            if (prev) {
              prev.count += 1;
              if (!log.resolved) prev.allResolved = false;
              if (new Date(log.created_at) > new Date(prev.log.created_at)) prev.log = log;
            } else {
              acc.set(key, { log, count: 1, allResolved: log.resolved });
            }
            return acc;
          }, new Map<string, { log: (typeof logs)[number]; count: number; allResolved: boolean }>())
          .values(),
      ).sort((a, b) => +new Date(b.log.created_at) - +new Date(a.log.created_at))
    : logs.map((log) => ({ log, count: 1, allResolved: log.resolved }));

  const entries = hideResolved ? allEntries.filter((e) => !e.allResolved) : allEntries;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по событию, сообщению или email"
            className="w-full sm:max-w-xs"
            aria-label="Поиск по журналу"
          />
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger className="w-[170px]" aria-label="Категория">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              <SelectItem value="auth">Входы в систему</SelectItem>
              <SelectItem value="error">Сбои и ошибки</SelectItem>
              <SelectItem value="action">Действия</SelectItem>
              <SelectItem value="system">Система</SelectItem>
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger className="w-[170px]" aria-label="Уровень">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все уровни</SelectItem>
              <SelectItem value="info">Информация</SelectItem>
              <SelectItem value="warning">Предупреждения</SelectItem>
              <SelectItem value="error">Ошибки</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={grouped ? "default" : "outline"}
            onClick={() => setGrouped((v) => !v)}
            aria-pressed={grouped}
          >
            <Layers className="size-4" aria-hidden="true" />
            {grouped ? "Одинаковые сгруппированы" : "Группировать одинаковые"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Обновить
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              onClick={() => purgeMutation.mutate()}
              disabled={purgeMutation.isPending}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Очистить старше 30 дней
            </Button>
          )}
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Записей пока нет.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map(({ log, count }) => (
            <Card key={log.id}>
              <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CategoryIcon category={log.category} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{log.event}</span>
                    {count > 1 && (
                      <Badge variant="outline" className="border-foreground/20">
                        {count} раз
                      </Badge>
                    )}
                    <Badge variant="outline" className={levelStyle(log.level)}>
                      {levelLabels[log.level] ?? log.level}
                    </Badge>
                    <Badge variant="secondary">
                      {categoryLabels[log.category] ?? log.category}
                    </Badge>
                  </div>
                  {log.message && (
                    <p className="break-words text-sm text-muted-foreground">{log.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {count > 1 ? "Последний раз: " : ""}
                    {new Date(log.created_at).toLocaleString("ru-RU")}
                    {log.user_email ? ` • ${log.user_email}` : ""}
                    {log.ip_address ? ` • IP ${log.ip_address}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
