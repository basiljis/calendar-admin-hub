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
import { useEmployeeCanCreateShifts } from "@/components/settings/SystemSettings";
import { HelpHint } from "@/components/Hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function addHour(time: string, hours = 1): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const d = new Date(2000, 0, 1, h, m ?? 0);
  d.setHours(d.getHours() + hours);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const START_LABEL = `${String(SHIFT_START_HOUR).padStart(2, "0")}:00`;
const END_LABEL = `${String(SHIFT_END_HOUR).padStart(2, "0")}:00`;

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
  const employeeCanCreateShifts = useEmployeeCanCreateShifts();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<string>("");
  const [now, setNow] = useState(() => new Date());
  const [dayBreaks, setDayBreaks] = useState<Record<string, string>>({});
  const [genOpen, setGenOpen] = useState(false);
  const [genMode, setGenMode] = useState<"month" | "fromToday" | "until">("month");
  const [genUntil, setGenUntil] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [anchor, setAnchor] = useState<string>(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });


  // Обновляем прогресс смены в реальном времени
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Сбрасываем локальные значения обеда при открытии/закрытии диалога дня
  useEffect(() => {
    setDayBreaks({});
  }, [openDay]);

  const first = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-01`;
  const days = monthDays(cursor.year, cursor.month);
  const last = days[days.length - 1]!;

  // Видимый период зависит от режима отображения: месяц / неделя / день
  const weekDays = (() => {
    const d = parseISO(anchor);
    const offset = (d.getDay() + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - offset);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(start);
      x.setDate(start.getDate() + i);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    });
  })();
  const visibleDays = view === "month" ? days : view === "week" ? weekDays : [anchor];
  const rangeFrom = visibleDays[0]! < first ? visibleDays[0]! : first;
  const rangeTo = visibleDays[visibleDays.length - 1]! > last ? visibleDays[visibleDays.length - 1]! : last;

  function shiftAnchor(deltaDays: number) {
    const d = parseISO(anchor);
    d.setDate(d.getDate() + deltaDays);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setAnchor(iso);
    setCursor({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const { data } = useQuery({
    queryKey: ["calendar", rangeFrom, rangeTo],

    queryFn: async () => {
      const [profiles, shifts, holidays, vacations] = await Promise.all([
        supabase.from("profiles").select("id, full_name, shift_group").order("full_name"),
        supabase.from("shifts").select("*").gte("work_date", rangeFrom).lte("work_date", rangeTo),
        supabase
          .from("holidays")
          .select("holiday_date, name, is_working")
          .gte("holiday_date", rangeFrom)
          .lte("holiday_date", rangeTo),
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

  const allProfiles = data?.profiles ?? [];
  // Фильтр по группе: показываем и массово меняем расписание только выбранной группы
  const profiles =
    groupFilter === "all"
      ? allProfiles
      : allProfiles.filter((p) => String(p.shift_group) === groupFilter);
  const visibleIds = new Set(profiles.map((p) => p.id));
  const shifts = (data?.shifts ?? []).filter((s) => visibleIds.has(s.user_id));
  const groups = Array.from(new Set(allProfiles.map((p) => p.shift_group))).sort((a, b) => a - b);

  // Сотрудник всегда видит подробный график по себе.
  // Администратор/руководитель выбирает сотрудника из списка.
  const detailUserId = isAdmin ? detailUser : (user?.id ?? "");
  const detailProfile = profiles.find((p) => p.id === detailUserId) ?? null;

  const generate = useMutation({
    mutationFn: async (range?: { from: string; to: string }) => {
      const from = range?.from ?? first;
      const to = range?.to ?? last;
      const targetDays = days.filter((d) => d >= from && d <= to);
      const rows: {
        user_id: string;
        work_date: string;
        hours: number;
        type: "work" | "vacation";
        break_time?: string;
      }[] = [];
      for (const p of profiles) {
        const vac = vacationDatesInRange(data?.vacations ?? [], from, to);

        for (const d of targetDays) {
          if (vac.has(d)) {
            rows.push({ user_id: p.id, work_date: d, hours: 0, type: "vacation" });
          } else if (isWorkingDay(d, p.shift_group)) {
            rows.push({ user_id: p.id, work_date: d, hours: SHIFT_WORK_HOURS, type: "work", break_time: "13:00" });
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
      setGenOpen(false);
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const toggle = useMutation({
    mutationFn: async ({
      userId,
      date,
      on,
      breakTime,
    }: {
      userId: string;
      date: string;
      on: boolean;
      breakTime?: string;
    }) => {
      if (on) {
        const { error } = await supabase.from("shifts").upsert(
          {
            user_id: userId,
            work_date: date,
            hours: SHIFT_WORK_HOURS,
            type: "work",
            break_time: breakTime || "13:00",
          },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
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
      if (!breakTime) {
        throw new Error("Укажите время обеда");
      }
      const { error } = await supabase
        .from("shifts")
        .update({ break_time: breakTime })
        .eq("user_id", userId)
        .eq("work_date", date);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
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

  // Сводка всегда считается за месяц, независимо от режима отображения
  const monthShifts = shifts.filter((s) => s.work_date >= first && s.work_date <= last);

  const monthHours = monthShifts
    .filter((s) => s.type === "work")
    .reduce((a, s) => a + Number(s.hours), 0);

  // Часы, «потерянные» из-за отпусков: дни отпуска, которые по графику были бы рабочими
  const vacationHours = monthShifts
    .filter((s) => s.type === "vacation")
    .reduce((a, s) => {
      const p = profiles.find((x) => x.id === s.user_id);
      if (!p) return a;
      return isWorkingDay(s.work_date, p.shift_group) ? a + SHIFT_WORK_HOURS : a;
    }, 0);

  const plannedHours = monthHours + vacationHours;

  // Уже отработано: завершённые смены (дни до сегодня; сегодня — после 20:00)
  const passedHours = monthShifts
    .filter(
      (s) =>
        s.type === "work" &&
        (s.work_date < todayStr ||
          (s.work_date === todayStr && getShiftProgress(s.work_date, now).status === "done")),
    )
    .reduce((a, s) => a + Number(s.hours), 0);

  const passedPercent = monthHours > 0 ? Math.round((passedHours / monthHours) * 100) : 0;

  const ruDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
  const headerTitle =
    view === "month"
      ? `${MONTH_NAMES[cursor.month - 1]} ${cursor.year}`
      : view === "week"
        ? `${ruDate.format(parseISO(weekDays[0]!))} — ${ruDate.format(parseISO(weekDays[6]!))} ${parseISO(weekDays[6]!).getFullYear()}`
        : `${ruDate.format(parseISO(anchor))} ${parseISO(anchor).getFullYear()}`;
  const navLabel = view === "month" ? "месяц" : view === "week" ? "неделю" : "день";

  function goPrev() {
    if (view === "month") shiftMonth(-1);
    else shiftAnchor(view === "week" ? -7 : -1);
  }
  function goNext() {
    if (view === "month") shiftMonth(1);
    else shiftAnchor(view === "week" ? 7 : 1);
  }
  function goToday() {
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() + 1 });
    setAnchor(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
  }

  return (
    <div className="space-y-6">
      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-muted/60 flex items-center gap-1 rounded-full border p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={goPrev}
              aria-label={`Предыдущий ${navLabel}`}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-xs font-semibold"
              onClick={goToday}
            >
              Сегодня
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={goNext}
              aria-label={`Следующий ${navLabel}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {headerTitle}
            </h1>
            <p className="text-muted-foreground truncate text-xs sm:text-sm">
              {detailProfile
                ? `Подробный график · ${detailProfile.full_name || "Без имени"} · группа ${detailProfile.shift_group}`
                : groupFilter === "all"
                  ? "Смены 2/2 · по отделению"
                  : `Смены 2/2 · группа ${groupFilter} · ${profiles.length} сотр.`}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div
            role="group"
            aria-label="Режим отображения календаря"
            className="bg-muted/60 flex items-center gap-1 rounded-full border p-1"
          >
            {([
              { key: "month", label: "Месяц" },
              { key: "week", label: "Неделя" },
              { key: "day", label: "День" },
            ] as const).map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={view === o.key}
                onClick={() => setView(o.key)}
                className={`focus-visible:ring-ring h-8 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  view === o.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {isAdmin && (
            <Select
              value={groupFilter}
              onValueChange={(v) => {
                setGroupFilter(v);
                setDetailUser("");
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Фильтр по группе">
                <SelectValue placeholder="Группа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Группа {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Select value={detailUser || "all"} onValueChange={(v) => setDetailUser(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Подробный график сотрудника">
                <SelectValue placeholder="Подробный график сотрудника" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники (общий вид)</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || "Без имени"} · группа {p.shift_group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ShiftVacationLegend />
          {isAdmin && (
            <Button
              className="rounded-full"
              onClick={() => {
                const t = new Date();
                const isCurrentMonth =
                  t.getFullYear() === cursor.year && t.getMonth() + 1 === cursor.month;
                if (isCurrentMonth && t.getDate() > 1) {
                  setGenMode("fromToday");
                  setGenUntil(last);
                  setGenOpen(true);

                } else {
                  generate.mutate({ from: first, to: last });
                }
              }}
              disabled={generate.isPending}
            >
              <Wand2 className="size-4" />
              {groupFilter === "all" ? "Сформировать месяц" : `Сформировать месяц · группа ${groupFilter}`}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Формирование расписания</DialogTitle>
            <DialogDescription>
              {groupFilter === "all"
                ? "Месяц уже начался. Выберите, за какой период сформировать график."
                : `Расписание будет сформировано только для группы ${groupFilter} (${profiles.length} сотр.). Выберите период.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {[
              { key: "month", label: "Сформировать на весь месяц" },
              { key: "fromToday", label: "Сформировать с текущей даты до конца месяца" },
              { key: "until", label: "Сформировать до выбранной даты" },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setGenMode(o.key as typeof genMode)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                  genMode === o.key ? "border-primary bg-primary/10" : "hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
            {genMode === "until" && (
              <input
                type="date"
                value={genUntil}
                min={first}
                max={last}
                onChange={(e) => setGenUntil(e.target.value)}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                aria-label="Дата окончания формирования"
              />
            )}
            <Button
              className="w-full"
              disabled={generate.isPending || (genMode === "until" && !genUntil)}
              onClick={() => {
                const t = new Date();
                const todayIso = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
                if (genMode === "month") generate.mutate({ from: first, to: last });
                else if (genMode === "fromToday") generate.mutate({ from: todayIso, to: last });
                else generate.mutate({ from: todayIso, to: genUntil });
              }}
            >
              Сформировать
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <div className="bg-card overflow-hidden rounded-2xl border shadow-sm">
        <div className={`grid border-b ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
          {(view === "day"
            ? [WEEKDAYS[(parseISO(anchor).getDay() + 6) % 7]!]
            : WEEKDAYS
          ).map((w) => (
            <div
              key={w}
              className="text-muted-foreground px-2 py-2.5 text-center text-[11px] font-semibold tracking-wider uppercase"
            >
              {w}
            </div>
          ))}
        </div>
        <div className={`grid ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
          {view === "month" &&
            Array.from({ length: leadingBlanks }).map((_, i) => {
              const prevLast = new Date(cursor.year, cursor.month - 1, 0).getDate();
              return (
                <div
                  key={`b${i}`}
                  className="bg-muted/25 text-muted-foreground/50 min-h-20 border-r border-b p-2 text-sm sm:min-h-28"
                >
                  {prevLast - leadingBlanks + 1 + i}
                </div>
              );
            })}
          {visibleDays.map((d) => {

            const holiday = data?.holidays.get(d);
            const list = shiftsOn(d);
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const isToday = d === todayStr;
            const isPastDay = d < todayStr;
            const hasVacation = list.some((s) => s.type === "vacation");
            return (
              <button
                key={d}
                onClick={() => setOpenDay(d)}
                className={`group relative min-w-0 border-r border-b p-1.5 text-left align-top transition-colors sm:p-2 ${
                  view === "month"
                    ? "min-h-20 sm:min-h-28"
                    : view === "week"
                      ? "min-h-40 sm:min-h-64"
                      : "min-h-[28rem] p-3 sm:p-4"
                } ${
                  holiday ? "bg-holiday/40" : "bg-card hover:bg-muted/50"
                } ${isPastDay && !isToday ? "opacity-90" : ""} ${
                  hasVacation && !holiday ? "bg-amber-50/50" : ""
                } ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`flex size-7 items-center justify-center rounded-full text-base ${
                      isToday
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "font-semibold"
                    }`}
                  >
                    {Number(d.slice(-2))}
                  </span>
                  {holiday && (
                    <span className="text-holiday-foreground max-w-16 truncate pt-0.5 text-[10px]">
                      {holiday.name}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {detailUserId ? (() => {
                    const s = list.find((x) => x.user_id === detailUserId);
                    if (!s) {
                      return <div className="text-muted-foreground/70 text-[10px]">Выходной</div>;
                    }
                    if (s.type === "vacation") {
                      return (
                        <div className="flex items-center gap-1 rounded-md bg-amber-100/70 px-1.5 py-1 text-[10px] font-medium text-amber-800">
                          <Plane className="size-2.5" /> Отпуск
                        </div>
                      );
                    }
                    const pr = getShiftProgress(d, now);
                    return (
                      <div
                        className={`space-y-0.5 rounded-md px-1.5 py-1 text-[10px] leading-tight ${
                          pr.status === "done"
                            ? "bg-emerald-50 text-emerald-800"
                            : pr.status === "active"
                              ? "bg-primary/10 text-foreground"
                              : "bg-muted/70 text-foreground"
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Начало</span>
                          <span className="font-medium">{START_LABEL}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Обед</span>
                          <span className="font-medium">
                            {s.break_time ? `${s.break_time}–${addHour(s.break_time)}` : "не выбран"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Конец</span>
                          <span className="font-medium">{END_LABEL}</span>
                        </div>
                        {pr.status === "active" && (
                          <div className="bg-background/60 h-1 w-full overflow-hidden rounded-full">
                            <div className="h-full bg-emerald-600" style={{ width: `${pr.percent}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })() : list.map((s) => {
                    const p = profiles.find((x) => x.id === s.user_id);
                    if (!p) return null;
                    if (s.type === "vacation") {
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-1.5 truncate rounded-md bg-amber-100/70 px-2 py-1 text-xs font-semibold text-amber-800 sm:text-sm"
                        >
                          <Plane className="size-3 shrink-0" />
                          <span className="truncate">{p.full_name.split(" ")[0]}</span>
                        </div>
                      );
                    }
                    const progress = getShiftProgress(d, now);
                    const done = progress.status === "done";
                    const chipBg = done
                      ? "bg-emerald-50 text-emerald-800"
                      : p.shift_group === 1
                        ? "bg-shift-a/12 text-foreground"
                        : "bg-shift-b/12 text-foreground";
                    const dot = done
                      ? "bg-emerald-600"
                      : p.shift_group === 1
                        ? "bg-shift-a"
                        : "bg-shift-b";
                    return (
                      <div
                        key={s.id}
                        title={progress.remainingLabel}
                        className={`relative overflow-hidden rounded-md px-2 py-1 text-xs sm:text-sm ${chipBg}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {done ? (
                              <CheckCircle2 className="size-3 shrink-0" />
                            ) : (
                              <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                            )}
                            <span className="truncate font-semibold">{p.full_name.split(" ")[0]}</span>
                          </span>
                          <span className="shrink-0 text-[11px] opacity-70">
                            {progress.status === "active"
                              ? `${Math.round(progress.percent)}%`
                              : s.break_time
                                ? <span className="hidden sm:inline">{s.break_time}</span>
                                : null}
                          </span>
                        </div>
                        {progress.status === "active" && (
                          <span
                            className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-600 transition-all duration-1000"
                            style={{ width: `${progress.percent}%` }}
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
          {view === "month" &&
            Array.from({ length: (7 - ((leadingBlanks + days.length) % 7)) % 7 }).map((_, i) => (
            <div
              key={`t${i}`}
              className="bg-muted/25 text-muted-foreground/50 min-h-20 border-r border-b p-2 text-sm sm:min-h-28"
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

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
                <div className="flex items-center gap-1.5">
                  <p className="text-foreground/90 text-sm font-semibold">Выходит с учётом отпуска</p>
                  <HelpHint text="Расчётная норма часов после вычета подтверждённых отпусков и нерабочих праздничных дней." />
                </div>
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
                <div className="flex items-center gap-1.5">
                  <p className="text-foreground/90 text-sm font-semibold">Уже прошло</p>
                  <HelpHint text="Количество часов, которые уже прошли в текущем месяце по календарю, включая завершённые и текущие смены." />
                </div>
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
                    {(isAdmin || (employeeCanCreateShifts && p.id === user?.id)) && (
                      <div className="flex items-center gap-2">
                        {isVacation && (
                           <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0">
                            Отпуск
                           </Badge>
                        )}
                        <Switch
                          checked={on}
                          onCheckedChange={(v) => {
                            if (!openDay) return;
                            if (v) {
                              setDayBreaks((prev) => ({ ...prev, [p.id]: "13:00" }));
                              toggle.mutate({ userId: p.id, date: openDay, on: true, breakTime: "13:00" });
                            } else {
                              setDayBreaks((prev) => {
                                const next = { ...prev };
                                delete next[p.id];
                                return next;
                              });
                              toggle.mutate({ userId: p.id, date: openDay, on: false });
                            }
                          }}
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
                      <label className="text-xs font-medium shrink-0">
                        Время обеда<span className="text-destructive">*</span>:
                      </label>
                      <input
                        type="time"
                        required
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={dayBreaks[p.id] ?? shift?.break_time ?? ""}
                        onChange={(e) => setDayBreaks((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={(e) => {
                          if (!openDay) return;
                          const value = e.target.value;
                          if (!value) {
                            toast.error("Укажите время обеда");
                            setDayBreaks((prev) => ({
                              ...prev,
                              [p.id]: shift?.break_time || "13:00",
                            }));
                            return;
                          }
                          updateShift.mutate({
                            userId: p.id,
                            date: openDay,
                            breakTime: value,
                          });
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

