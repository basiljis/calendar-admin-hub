import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SETTING_WEEKEND_DAYS = "weekend_days";

/** 0 — воскресенье, 6 — суббота */
export type WeekdayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DEFAULT_WEEKEND_DAYS: WeekdayNumber[] = [];

function parse(value: unknown): WeekdayNumber[] {
  if (!Array.isArray(value)) return DEFAULT_WEEKEND_DAYS;
  return value
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6) as WeekdayNumber[];
}

export function useWeekendDays() {
  const { data } = useQuery({
    queryKey: ["app-setting", SETTING_WEEKEND_DAYS],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_WEEKEND_DAYS)
        .maybeSingle();
      return parse(data?.value);
    },
  });
  return data ?? DEFAULT_WEEKEND_DAYS;
}

/** Дата (YYYY-MM-DD) попадает на выходной день недели */
export function isWeekendDate(iso: string, weekendDays: WeekdayNumber[]) {
  if (weekendDays.length === 0) return false;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d).getDay() as WeekdayNumber;
  return weekendDays.includes(day);
}
