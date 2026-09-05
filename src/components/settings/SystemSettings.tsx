import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recordEvent } from "@/lib/log-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SETTING_ATTENDANCE_ENABLED,
  SETTING_ATTENDANCE_MODE,
  useAttendanceSettings,
} from "@/hooks/useAttendance";

export const SETTING_EMPLOYEE_SHIFTS = "employee_can_create_shifts";

export function useEmployeeCanCreateShifts() {
  const { data } = useQuery({
    queryKey: ["app-setting", SETTING_EMPLOYEE_SHIFTS],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_EMPLOYEE_SHIFTS)
        .maybeSingle();
      return data?.value === true;
    },
  });
  return data ?? false;
}

export function SystemSettings() {
  const qc = useQueryClient();
  const enabled = useEmployeeCanCreateShifts();

  const save = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: SETTING_EMPLOYEE_SHIFTS, value }, { onConflict: "key" });
      if (error) throw error;
      return value;
    },
    onSuccess: (v) => {
      recordEvent({
        category: "action",
        event: "Изменение настроек системы",
        message: `Создание смен сотрудниками: ${v ? "включено" : "выключено"}`,
      });
      toast.success(v ? "Сотрудники могут создавать смены" : "Создание смен сотрудниками отключено");
      qc.invalidateQueries({ queryKey: ["app-setting", SETTING_EMPLOYEE_SHIFTS] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" />
          Система
        </CardTitle>
        <CardDescription>Общие правила работы сотрудников в системе.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="employee-shifts" className="text-sm font-medium">
              Сотрудник может сам создавать смены
            </Label>
            <p className="text-muted-foreground text-sm">
              Если выключено, добавлять и изменять смены в календаре могут только администратор и
              руководитель.
            </p>
          </div>
          <Switch
            id="employee-shifts"
            checked={enabled}
            disabled={save.isPending}
            onCheckedChange={(v) => save.mutate(v)}
          />
        </div>

        <div className="mt-4 space-y-4 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="attendance-enabled" className="text-sm font-medium">
                Отметка присутствия на смене
              </Label>
              <p className="text-muted-foreground text-sm">
                Сотрудник отмечает, что был на смене — время отметки сохраняется автоматически.
              </p>
            </div>
            <Switch
              id="attendance-enabled"
              checked={attendance.enabled}
              disabled={saveAttendance.isPending}
              onCheckedChange={(v) => saveAttendance.mutate({ key: SETTING_ATTENDANCE_ENABLED, value: v })}
            />
          </div>

          {attendance.enabled && (
            <RadioGroup
              value={attendance.mode}
              onValueChange={(v) => saveAttendance.mutate({ key: SETTING_ATTENDANCE_MODE, value: v })}
              className="gap-3 border-t pt-4"
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="manual" id="attendance-manual" className="mt-1" />
                <Label htmlFor="attendance-manual" className="space-y-1 font-normal">
                  <span className="block text-sm font-medium">Сотрудник отмечается сам</span>
                  <span className="text-muted-foreground block text-sm">
                    В шапке появляется кнопка «Отметиться» в дни рабочей смены.
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="auto" id="attendance-auto" className="mt-1" />
                <Label htmlFor="attendance-auto" className="space-y-1 font-normal">
                  <span className="block text-sm font-medium">Автоматически при первом входе</span>
                  <span className="text-muted-foreground block text-sm">
                    Отметка ставится сама, когда сотрудник впервые заходит в систему в день смены.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
