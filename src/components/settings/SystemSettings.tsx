import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
      </CardContent>
    </Card>
  );
}
