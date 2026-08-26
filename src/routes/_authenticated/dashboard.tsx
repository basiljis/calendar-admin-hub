import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, Plane, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  MONTH_NAMES,
  PERIOD,
  formatHours,
  parseISO,
  personalNorm,
  toISO,
  vacationDatesInRange,
} from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Мой график — График ОКП" },
      {
        name: "description",
        content: "Личный график смен, отработанные часы и норма за отчётный период.",
      },
      { property: "og:title", content: "Мой график — График ОКП" },
      { property: "og:description", content: "Смены, часы и отпуска сотрудника ОКП." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["my-period", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [shifts, vacations, holidays] = await Promise.all([
        supabase
          .from("shifts")
          .select("*")
          .eq("user_id", user!.id)
          .gte("work_date", PERIOD.start)
          .lte("work_date", PERIOD.end)
          .order("work_date"),
        supabase.from("vacations").select("*").eq("user_id", user!.id),
        supabase.from("holidays").select("holiday_date, name, is_working"),
      ]);
      return {
        shifts: shifts.data ?? [],
        vacations: vacations.data ?? [],
        holidays: new Map((holidays.data ?? []).map((h) => [h.holiday_date, { name: h.name, is_working: h.is_working }])),
      };
    },
  });

  const shifts = data?.shifts ?? [];
  const workShifts = shifts.filter((s) => s.type === "work");
  const plannedHours = workShifts.reduce((a, s) => a + Number(s.hours), 0);
  const vacationDays = vacationDatesInRange(data?.vacations ?? [], PERIOD.start, PERIOD.end).size;
  const nonWorkingHolidaysCount = Array.from(data?.holidays.values() ?? []).filter(h => !h.is_working).length;
  const norm = personalNorm(vacationDays, PERIOD.normHours, nonWorkingHolidaysCount);
  const diff = plannedHours - norm;
  const holidayShifts = workShifts.filter((s) => data?.holidays.has(s.work_date));

  const todayISO = toISO(new Date());
  const upcoming = workShifts.filter((s) => s.work_date >= todayISO).slice(0, 6);

  const byMonth = PERIOD.months.map((m) => {
    const prefix = `${m.year}-${String(m.month).padStart(2, "0")}`;
    const list = workShifts.filter((s) => s.work_date.startsWith(prefix));
    return {
      ...m,
      shifts: list.length,
      hours: list.reduce((a, s) => a + Number(s.hours), 0),
    };
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Добро пожаловать, {profile?.full_name?.split(' ')[0] || "Сотрудник"}!
        </h1>
        <p className="text-muted-foreground/80">
          Обзор показателей · Группа {profile?.shift_group ?? 1} · Период {PERIOD.label}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Норма за период"
          value={`${formatHours(norm)} ч`}
          hint={`База ${formatHours(PERIOD.normHours)} ч`}
          color="blue"
        />
        <StatCard
          icon={CalendarCheck}
          label="Запланировано"
          value={`${formatHours(plannedHours)} ч`}
          hint={`${workShifts.length} смен`}
          color="orange"
        />
        <StatCard
          icon={Sparkles}
          label="Отклонение"
          value={`${diff >= 0 ? "+" : "−"}${formatHours(Math.abs(diff))} ч`}
          hint={Math.abs(diff) < 0.05 ? "В пределах нормы" : "Требует внимания"}
          color="blue"
        />
        <StatCard
          icon={Plane}
          label="Дни отпуска"
          value={String(vacationDays)}
          hint="Использовано дней"
          color="orange"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Выработка по месяцам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {byMonth.map((m) => {
              const monthNorm = norm / PERIOD.months.length;
              const pct = monthNorm > 0 ? Math.min(100, (m.hours / monthNorm) * 100) : 0;
              return (
                <div key={m.month} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-foreground/90">{m.label}</span>
                    <span className="text-muted-foreground">
                      {formatHours(m.hours)} ч · {m.shifts} смен
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 bg-secondary" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Ближайшие смены</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-muted-foreground text-sm py-4 text-center">Смены ещё не назначены.</p>
            )}
            {upcoming.map((s) => {
              const d = parseISO(s.work_date);
              const holiday = data?.holidays.get(s.work_date);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-background/40 p-3 text-sm transition-colors hover:bg-background/60"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground/90">
                      {d.getDate()} {MONTH_NAMES[d.getMonth()]?.toLowerCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {format(d, "eeee", { locale: ru })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {holiday && (
                      <Badge className="bg-holiday/50 text-holiday-foreground hover:bg-holiday/60 border-none text-[10px] h-5">
                        {holiday.name}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs font-mono">08:00–20:00</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Праздничные смены</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {holidayShifts.length === 0 && (
            <p className="text-muted-foreground text-sm col-span-full py-4 text-center">
              Смен в праздничные дни в периоде нет.
            </p>
          )}
          {holidayShifts.map((s) => (
            <div
              key={s.id}
              className="bg-holiday/30 flex items-center justify-between rounded-xl px-4 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground/90">{s.work_date.split("-").reverse().join(".")}</span>
                <span className="text-[10px] text-holiday-foreground/80 uppercase tracking-wider">Праздник</span>
              </div>
              <span className="text-holiday-foreground font-semibold">
                {data?.holidays.get(s.work_date)?.name}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  color?: "blue" | "orange";
}) {
  const colorClasses = color === "orange" 
    ? "bg-orange-50 text-orange-600 dark:bg-orange-950/20" 
    : "bg-blue-50 text-blue-600 dark:bg-blue-950/20";

  return (
    <Card className="border-none shadow-sm bg-card/50 backdrop-blur">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className={`flex size-12 items-center justify-center rounded-2xl ${colorClasses}`}>
            <Icon className="size-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={color === "orange" ? "text-orange-600" : "text-blue-600"}>↑</span>
          {hint}
        </div>
      </CardContent>
    </Card>
  );
}
