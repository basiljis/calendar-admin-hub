import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Wand2, Plane, CheckCircle2, CalendarDays, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { ShiftVacationLegend } from "@/components/ShiftVacationLegend";
import { HelpHint } from "@/components/Hint";
import {
  MONTH_NAMES,
  PERIOD,
  SHIFT_WORK_HOURS,
  WEEKDAYS,
  isWorkingDay,
  monthDays,
  parseISO,
  vacationDatesInRange,
} from "@/lib/schedule";


// Смена длится 12 часов: 08:00 — 20:00 (1 час — перерыв на обед)
const SHIFT_START_HOUR = 8;
const SHIFT_END_HOUR = 20;

type ShiftProgress = {
  status: "future" | "active" | "done";
  percent: number;
  remainingLabel: string;
};

function getShiftProgress(date: string, now: Date): ShiftProgress {
  const start = new Date(`${date}T00:00:00`);
  start.setHours(SHIFT_START_HOUR, 0, 0, 0);
  const end = new Date(`${date}T00:00:00`);
  end.setHours(SHIFT_END_HOUR, 0, 0, 0);

  if (now >= end) return { status: "done", percent: 100, remainingLabel: "Смена завершена" };
  if (now <= start) return { status: "future", percent: 0, remainingLabel: "Смена ещё не началась" };

  const percent = ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
  const leftMin = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000));
  const h = Math.floor(leftMin / 60);
  const m = leftMin % 60;
  return {
    status: "active",
    percent,
    remainingLabel: `До конца смены ${h > 0 ? `${h} ч ` : ""}${m} мин`,
  };
}

type Profile = {
  id: string;
  full_name: string;
  shift_group: number;
};

export function CalendarPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Обновляем прогресс смены в реальном времени
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const first = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-01`;
  const days = monthDays(cursor.year, cursor.month);
  const last = days[days.length - 1]!;

  const { data } = useQuery({
    queryKey: ["calendar", first],
    queryFn: async () => {
      const [profiles, shifts, holidays, vacations] = await Promise.all([
        supabase.from("profiles").select("id, full_name, shift_group").order("full_name"),
        supabase.from("shifts").select("*").gte("work_date", first).lte("work_date", last),
        supabase
          .from("holidays")
          .select("holiday_date, name, is_working")
          .gte("holiday_date", first)
          .lte("holiday_date", last),
        supabase.from("vacations").select("*"),
      ]);
      return {
        profiles: (profiles.data ?? []) as Profile[],
        shifts: shifts.data ?? [],
        holidays: new Map(
          (holidays.data ?? []).map((h) => [h.holiday_date, { name: h.name, is_working: h.is_working }]),
        ),
        vacations: vacations.data ?? [],
      };
    },
  });

  const profiles = data?.profiles ?? [];
  const shifts = data?.shifts ?? [];

  const generate = useMutation({
    mutationFn: async () => {
      const rows: {
        user_id: string;
        work_date: string;
        hours: number;
        type: "work" | "vacation";
      }[] = [];
      for (const p of profiles) {
        const vac = vacationDatesInRange(data?.vacations ?? [], first, last);
        
        for (const d of days) {
          if (vac.has(d)) {
            rows.push({ user_id: p.id, work_date: d, hours: 0, type: "vacation" });
          } else if (isWorkingDay(d, p.shift_group)) {
            rows.push({ user_id: p.id, work_date: d, hours: SHIFT_WORK_HOURS, type: "work" });
          }
        }
      }
      const { error } = await supabase
        .from("shifts")
        .upsert(rows, { onConflict: "user_id,work_date" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`График сформирован: ${n} записей`);
      qc.invalidateQueries({ queryKey: ["calendar", first] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, date, on }: { userId: string; date: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("shifts").upsert(
          { user_id: userId, work_date: date, hours: SHIFT_WORK_HOURS, type: "work" },
          { onConflict: "user_id,work_date" },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shifts")
          .delete()
          .eq("user_id", userId)
          .eq("work_date", date);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar", first] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateHoliday = useMutation({
    mutationFn: async ({ date, isWorking }: { date: string; isWorking: boolean }) => {
      const { error } = await supabase
        .from("holidays")
        .update({ is_working: isWorking })
        .eq("holiday_date", date);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar", first] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateShift = useMutation({
    mutationFn: async ({
      userId,
      date,
      breakTime,
    }: {
      userId: string;
      date: string;
      breakTime: string;
    }) => {
      const { error } = await supabase
        .from("shifts")
        .update({ break_time: breakTime })
        .eq("user_id", userId)
        .eq("work_date", date);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar", first] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const leadingBlanks = (parseISO(first).getDay() + 6) % 7;

  function shiftsOn(date: string) {
    return shifts.filter((s) => s.work_date === date && (s.type === "work" || s.type === "vacation"));
  }

  function shiftMonth(delta: number) {
    const m = cursor.month + delta;
    setCursor({
      year: cursor.year + Math.floor((m - 1) / 12),
      month: ((((m - 1) % 12) + 12) % 12) + 1,
    });
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const monthHours = shifts
    .filter((s) => s.type === "work")
    .reduce((a, s) => a + Number(s.hours), 0);

  // Часы, «потерянные» из-за отпусков: дни отпуска, которые по графику были бы рабочими
  const vacationHours = shifts
    .filter((s) => s.type === "vacation")
    .reduce((a, s) => {
      const p = profiles.find((x) => x.id === s.user_id);
      if (!p) return a;
      return isWorkingDay(s.work_date, p.shift_group) ? a + SHIFT_WORK_HOURS : a;
    }, 0);

  const plannedHours = monthHours + vacationHours;

  // Уже отработано: завершённые смены (дни до сегодня; сегодня — после 20:00)
  const passedHours = shifts
    .filter(
      (s) =>
        s.type === "work" &&
        (s.work_date < todayStr ||
          (s.work_date === todayStr && getShiftProgress(s.work_date, now).status === "done")),
    )
    .reduce((a, s) => a + Number(s.hours), 0);

  const passedPercent = monthHours > 0 ? Math.round((passedHours / monthHours) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {MONTH_NAMES[cursor.month - 1]} {cursor.year}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Смены 2/2 · по отделению
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShiftVacationLegend />
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
          {isAdmin && (
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Wand2 className="size-4" />
              Сформировать месяц
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-muted-foreground pb-1 text-center text-xs font-medium">
                {w}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {days.map((d) => {
              const holiday = data?.holidays.get(d);
              const list = shiftsOn(d);
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
              const isToday = d === todayStr;
              const isPastDay = d < todayStr;
              return (
                <button
                  key={d}
                  onClick={() => setOpenDay(d)}
                  className={`min-h-24 rounded-lg border p-1.5 text-left align-top transition-colors ${
                    holiday ? "bg-holiday/50 border-holiday" : "bg-card hover:bg-secondary/60"
                  } ${isPastDay ? "opacity-80" : ""} ${isToday ? "ring-2 ring-primary border-primary" : ""} ${list.some(s => s.type === 'vacation') ? 'ring-1 ring-inset ring-amber-200 bg-amber-50/30' : ''} ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">{Number(d.slice(-2))}</span>
                    {holiday && (
                      <span className="text-holiday-foreground max-w-16 truncate text-[10px]">
                        {holiday.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {list.map((s) => {
                      const p = profiles.find((x) => x.id === s.user_id);
                      if (!p) return null;
                      if (s.type === "vacation") {
                        return (
                          <div
                            key={s.id}
                            className="truncate rounded px-1 py-0.5 text-[10px] bg-amber-100 text-amber-800 flex justify-between items-center border border-amber-200"
                          >
                            <span className="flex items-center gap-0.5">
                              <Plane className="size-2" />
                              {p.full_name.split(" ")[0]}
                            </span>
                          </div>
                        );
                      }
                      const progress = getShiftProgress(d, now);
                      const base =
                        progress.status === "done"
                          ? "bg-emerald-600"
                          : p.shift_group === 1
                            ? "bg-shift-a"
                            : "bg-shift-b";
                      return (
                        <div
                          key={s.id}
                          title={progress.remainingLabel}
                          className={`relative overflow-hidden truncate rounded px-1 py-0.5 text-[10px] text-white flex justify-between items-center ${base}`}
                        >
                          {progress.status === "active" && (
                            <span
                              className="absolute inset-y-0 left-0 bg-emerald-600 transition-all duration-1000"
                              style={{ width: `${progress.percent}%` }}
                              aria-hidden
                            />
                          )}
                          <span className="relative flex items-center gap-0.5">
                            {progress.status === "done" && <CheckCircle2 className="size-2.5" />}
                            {p.full_name.split(" ")[0]}
                          </span>
                          <span className="relative flex items-center gap-1">
                            {progress.status === "active" && (
                              <span className="scale-90 opacity-90">
                                {Math.round(progress.percent)}%
                              </span>
                            )}
                            {s.break_time && <span className="opacity-80 scale-90">{s.break_time}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-chart-1 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-foreground/90 text-sm font-semibold">Предполагается в месяце</p>
                  <HelpHint text="Плановое количество часов по графику смен за выбранный месяц, до вычета отпусков и праздников." />
                </div>
                <p className="mt-2 text-3xl font-bold tracking-tight text-chart-1">{plannedHours} ч</p>
              </div>
              <div className="bg-chart-1/15 flex size-10 items-center justify-center rounded-xl">
                <CalendarDays className="size-5 text-chart-1" />
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs font-medium">По графику 2/2 без учёта отпусков</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-2 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-foreground/90 text-sm font-semibold">Выходит с учётом отпуска</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-chart-2">{monthHours} ч</p>
              </div>
              <div className="bg-chart-2/15 flex size-10 items-center justify-center rounded-xl">
                <Plane className="size-5 text-chart-2" />
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs font-medium">
              {vacationHours > 0 ? `Минус ${vacationHours} ч отпусков` : "Отпусков в месяце нет"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-3 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-foreground/90 text-sm font-semibold">Уже прошло</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-chart-3">{passedHours} ч</p>
              </div>
              <div className="bg-chart-3/15 flex size-10 items-center justify-center rounded-xl">
                <TrendingUp className="size-5 text-chart-3" />
              </div>
            </div>
            <div className="bg-muted mt-4 h-2.5 w-full overflow-hidden rounded-full">
              <div className="h-full bg-chart-3" style={{ width: `${passedPercent}%` }} />
            </div>
            <p className="text-muted-foreground mt-2 text-xs font-medium">
              {passedPercent}% · осталось {Math.max(0, monthHours - passedHours)} ч
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Смены {openDay ? openDay.split("-").reverse().join(".") : ""}
            </DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Управление сменами и временем обеда сотрудников."
                : "Просмотр смен и выбор времени обеда."}
            </DialogDescription>
          </DialogHeader>
          {openDay && data?.holidays.get(openDay) && (
            <div className="space-y-3">
              <Badge className="bg-holiday text-holiday-foreground w-fit border-0">
                Праздник: {data.holidays.get(openDay)?.name}
              </Badge>
              <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                <div className="text-sm">
                  <div className="font-medium">Рабочий день</div>
                  <div className="text-muted-foreground text-xs">
                    Если выключено, день считается выходным и уменьшает норму часов.
                  </div>
                </div>
                <Switch
                  checked={data.holidays.get(openDay)?.is_working ?? false}
                  onCheckedChange={(v) =>
                    updateHoliday.mutate({ date: openDay, isWorking: v })
                  }
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            {profiles.map((p) => {
              const shift = shifts.find(
                (s) => s.user_id === p.id && s.work_date === openDay,
              );
              const on = shift?.type === "work";
              const isVacation = shift?.type === "vacation";
              const isOwnShift = user?.id === p.id;

              if (!isAdmin && !isOwnShift) return null;

              return (
                <div key={p.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{p.full_name || "Без имени"}</div>
                      <div className="text-muted-foreground text-xs">Группа {p.shift_group}</div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {isVacation && (
                           <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0">
                            Отпуск
                           </Badge>
                        )}
                        <Switch
                          checked={on}
                          onCheckedChange={(v) =>
                            openDay && toggle.mutate({ userId: p.id, date: openDay, on: v })
                          }
                        />
                      </div>
                    )}
                  </div>

                  {on && openDay && (
                    <div className="text-xs">
                      {(() => {
                        const pr = getShiftProgress(openDay, now);
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={pr.status === "done" ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                                {pr.remainingLabel}
                              </span>
                              <span className="text-muted-foreground">
                                {SHIFT_START_HOUR}:00 — {SHIFT_END_HOUR}:00
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-emerald-600 transition-all duration-1000"
                                style={{ width: `${pr.percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {on && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium shrink-0">Время обеда:</label>
                      <input
                        type="time"
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={shift.break_time || ""}
                        onBlur={(e) => {
                          if (openDay) {
                            updateShift.mutate({
                              userId: p.id,
                              date: openDay,
                              breakTime: e.target.value,
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-muted-foreground text-xs">
        Отчётный период: {PERIOD.label}. Норма — {PERIOD.normHours} ч без учёта отпуска.
      </p>
    </div>
  );
}

