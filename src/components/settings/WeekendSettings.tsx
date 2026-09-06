import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { recordEvent } from "@/lib/log-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SETTING_WEEKEND_DAYS, useWeekendDays, type WeekdayNumber } from "@/hooks/useWeekends";

const OPTIONS: { day: WeekdayNumber; label: string }[] = [
  { day: 6, label: "Суббота" },
  { day: 0, label: "Воскресенье" },
];

export function WeekendSettings({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const weekendDays = useWeekendDays();
  const [workingDate, setWorkingDate] = useState("");

  const save = useMutation({
    mutationFn: async (days: WeekdayNumber[]) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: SETTING_WEEKEND_DAYS, value: days }, { onConflict: "key" });
      if (error) throw error;
      return days;
    },
    onSuccess: (days) => {
      recordEvent({
        category: "action",
        event: "Изменение настроек системы",
        message: `Выходные дни недели: ${
          days.length === 0
            ? "не заданы"
            : days.map((d) => OPTIONS.find((o) => o.day === d)?.label ?? d).join(", ")
        }`,
      });
      toast.success("Настройка сохранена");
      qc.invalidateQueries({ queryKey: ["app-setting", SETTING_WEEKEND_DAYS] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeWorking = useMutation({
    mutationFn: async () => {
      if (!workingDate) throw new Error("Выберите дату");
      const { error } = await supabase
        .from("holidays")
        .upsert(
          { holiday_date: workingDate, name: "Рабочий день", is_working: true },
          { onConflict: "holiday_date" },
        );
      if (error) throw error;
      return workingDate;
    },
    onSuccess: (date) => {
      toast.success(`${new Date(date).toLocaleDateString("ru-RU")} — рабочий день`);
      setWorkingDate("");
      qc.invalidateQueries({ queryKey: ["admin-holidays"] });
      qc.invalidateQueries({ queryKey: ["holidays"] });
      qc.invalidateQueries({ queryKey: ["holidays-year"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4" />
          Выходные дни недели
        </CardTitle>
        <CardDescription>
          Выберите, какие дни недели считаются выходными. Отдельную дату можно сделать рабочей.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {OPTIONS.map((o) => (
          <div key={o.day} className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <Label htmlFor={`weekend-${o.day}`} className="text-sm font-medium">
              {o.label} — выходной
            </Label>
            <Switch
              id={`weekend-${o.day}`}
              checked={weekendDays.includes(o.day)}
              disabled={!canEdit || save.isPending}
              onCheckedChange={(v) =>
                save.mutate(
                  v
                    ? ([...weekendDays, o.day] as WeekdayNumber[])
                    : weekendDays.filter((d) => d !== o.day),
                )
              }
            />
          </div>
        ))}

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="working-date">Сделать конкретную дату рабочей</Label>
              <Input
                id="working-date"
                type="date"
                value={workingDate}
                onChange={(e) => setWorkingDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button
              onClick={() => makeWorking.mutate()}
              disabled={!workingDate || makeWorking.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              Сделать рабочим
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
