import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/notify";

export const SETTING_ATTENDANCE_ENABLED = "attendance_enabled";
export const SETTING_ATTENDANCE_MODE = "attendance_mode";

export type AttendanceMode = "manual" | "auto";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useAttendanceSettings() {
  const { data } = useQuery({
    queryKey: ["app-setting", "attendance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [SETTING_ATTENDANCE_ENABLED, SETTING_ATTENDANCE_MODE]);
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      const mode = map.get(SETTING_ATTENDANCE_MODE);
      return {
        enabled: map.get(SETTING_ATTENDANCE_ENABLED) === true,
        mode: (mode === "auto" ? "auto" : "manual") as AttendanceMode,
      };
    },
  });
  return data ?? { enabled: false, mode: "manual" as AttendanceMode };
}

/** Смена сотрудника на сегодня (только рабочая) + текущая отметка. */
export function useTodayAttendance() {
  const { user } = useAuth();
  const date = todayISO();

  const shift = useQuery({
    queryKey: ["attendance-shift", user?.id, date],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id, work_date, type, break_time, hours")
        .eq("user_id", user!.id)
        .eq("work_date", date)
        .eq("type", "work")
        .maybeSingle();
      return data ?? null;
    },
  });

  const mark = useQuery({
    queryKey: ["attendance-mark", user?.id, date],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_marks")
        .select("id, marked_at, source")
        .eq("user_id", user!.id)
        .eq("work_date", date)
        .maybeSingle();
      return data ?? null;
    },
  });

  return { date, shift: shift.data ?? null, mark: mark.data ?? null, loading: shift.isLoading || mark.isLoading };
}

export function useMarkAttendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, source }: { date: string; source: "manual" | "auto" }) => {
      const { error } = await supabase
        .from("attendance_marks")
        .insert({ user_id: user!.id, work_date: date, source });
      if (error && !error.message.includes("duplicate")) throw error;
      return source;
    },
    onSuccess: (source) => {
      qc.invalidateQueries({ queryKey: ["attendance-mark"] });
      qc.invalidateQueries({ queryKey: ["attendance-marks-day"] });
      if (source === "manual") toast.success("Отметка о присутствии сохранена");
    },
  });
}

/** Автоматическая отметка при первом входе в рабочую смену. */
export function useAutoAttendance() {
  const { enabled, mode } = useAttendanceSettings();
  const { date, shift, mark, loading } = useTodayAttendance();
  const markMut = useMarkAttendance();

  useEffect(() => {
    if (!enabled || mode !== "auto") return;
    if (loading || !shift || mark) return;
    if (markMut.isPending) return;
    markMut.mutate({ date, source: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, loading, shift?.id, mark?.id, date]);
}
