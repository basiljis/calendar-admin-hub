import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, Plane, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.full_name || "Мой график"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Группа {profile?.shift_group ?? 1} · отчётный период {PERIOD.label}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Норма за период"
          value={`${formatHours(norm)} ч`}
          hint={`База ${formatHours(PERIOD.normHours)} ч − отпуск`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Запланировано"
          value={`${formatHours(plannedHours)} ч`}
          hint={`${workShifts.length} смен по 11 ч`}
        />
        <StatCard
          icon={Sparkles}
          label="Отклонение"
          value={`${diff >= 0 ? "+" : "−"}${formatHours(Math.abs(diff))} ч`}
          hint={Math.abs(diff) < 0.05 ? "Норма выдержана" : "Скорректируйте смены"}
        />
        <StatCard
          icon={Plane}
          label="Дни отпуска"
          value={String(vacationDays)}
          hint="в пределах периода"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Выработка по месяцам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {byMonth.map((m) => {
            const monthNorm = norm / PERIOD.months.length;
            const pct = monthNorm > 0 ? Math.min(100, (m.hours / monthNorm) * 100) : 0;
            return (
              <div key={m.month}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground">
                    {formatHours(m.hours)} ч · {m.shifts} смен
                  </span>
                </div>
                <Progress value={pct} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ближайшие смены</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-muted-foreground text-sm">Смены ещё не назначены.</p>
            )}
            {upcoming.map((s) => {
              const d = parseISO(s.work_date);
              const holiday = data?.holidays.get(s.work_date);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>
                    {d.getDate()} {MONTH_NAMES[d.getMonth()]?.toLowerCase()}
                  </span>
                  <span className="flex items-center gap-2">
                    {holiday && (
                      <Badge className="bg-holiday text-holiday-foreground border-0">
                        {holiday.name}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">08:00–20:00 · 11 ч</span>
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Праздничные смены (доплата)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {holidayShifts.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Смен в праздничные дни в периоде нет.
              </p>
            )}
            {holidayShifts.map((s) => (
              <div
                key={s.id}
                className="bg-holiday/40 flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              >
                <span>{s.work_date.split("-").reverse().join(".")}</span>
                <span className="text-holiday-foreground font-medium">
                  {data?.holidays.get(s.work_date)?.name}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Icon className="size-4" />
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      </CardContent>
    </Card>
  );
}
