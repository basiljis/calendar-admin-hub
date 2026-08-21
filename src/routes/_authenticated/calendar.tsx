import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Календарь смен — График ОКП" },
      {
        name: "description",
        content:
          "Месячный календарь смен 2/2 по двум группам психологов, отпуска и праздничные дни.",
      },
      { property: "og:title", content: "Календарь смен — График ОКП" },
      { property: "og:description", content: "Автогенерация графика 2/2 и ручная правка смен." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

type Profile = {
  id: string;
  full_name: string;
  shift_group: number;
};

function CalendarPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState({ year: 2026, month: 9 });
  const [openDay, setOpenDay] = useState<string | null>(null);

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

  const leadingBlanks = (parseISO(first).getDay() + 6) % 7;

  function shiftsOn(date: string) {
    return shifts.filter((s) => s.work_date === date && s.type === "work");
  }

  function shiftMonth(delta: number) {
    const m = cursor.month + delta;
    setCursor({
      year: cursor.year + Math.floor((m - 1) / 12),
      month: ((((m - 1) % 12) + 12) % 12) + 1,
    });
  }

  const monthHours = shifts
    .filter((s) => s.type === "work")
    .reduce((a, s) => a + Number(s.hours), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {MONTH_NAMES[cursor.month - 1]} {cursor.year}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Смены 2/2 · всего {monthHours} рабочих часов по отделению
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex flex-wrap gap-3 text-xs">
        <Legend color="bg-shift-a" label="Группа 1" />
        <Legend color="bg-shift-b" label="Группа 2" />
        <Legend color="bg-holiday" label="Праздничный день (доплата)" />
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
              return (
                <button
                  key={d}
                  onClick={() => isAdmin && setOpenDay(d)}
                  className={`min-h-24 rounded-lg border p-1.5 text-left align-top transition-colors ${
                    holiday ? "bg-holiday/50 border-holiday" : "bg-card hover:bg-secondary/60"
                  } ${isAdmin ? "cursor-pointer" : "cursor-default"}`}
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
                      return (
                        <div
                          key={s.id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] text-white ${
                            p.shift_group === 1 ? "bg-shift-a" : "bg-shift-b"
                          }`}
                        >
                          {p.full_name.split(" ")[0]}
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

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Смены {openDay ? openDay.split("-").reverse().join(".") : ""}
            </DialogTitle>
            <DialogDescription>
              Отметьте сотрудников, которые работают в этот день (11 рабочих часов).
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
                  checked={data.holidays.get(openDay)?.is_working}
                  onCheckedChange={(v) =>
                    updateHoliday.mutate({ date: openDay, isWorking: v })
                  }
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            {profiles.map((p) => {
              const on = !!shifts.find(
                (s) => s.user_id === p.id && s.work_date === openDay && s.type === "work",
              );
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{p.full_name || "Без имени"}</div>
                    <div className="text-muted-foreground text-xs">Группа {p.shift_group}</div>
                  </div>
                  <Switch
                    checked={on}
                    onCheckedChange={(v) =>
                      openDay && toggle.mutate({ userId: p.id, date: openDay, on: v })
                    }
                  />
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 rounded ${color}`} />
      {label}
    </span>
  );
}
