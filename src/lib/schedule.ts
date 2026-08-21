// Опорные цифры из технического задания (ОКП, психологи)
export const SHIFT_LENGTH = 12; // продолжительность смены, ч
export const SHIFT_WORK_HOURS = 11; // из них рабочих (1 ч — перерыв)

/** Норма рабочих часов на 2026 год без отпуска */
export const YEAR_NORM_2026 = 1774.4;
/** Норма 2026 с учётом 56 календарных дней отпуска */
export const YEAR_NORM_2026_WITH_VACATION = 1486.4;
export const VACATION_DAYS_BASE = 56;
/** Сколько часов нормы «снимает» один календарный день отпуска */
export const HOURS_PER_VACATION_DAY =
  (YEAR_NORM_2026 - YEAR_NORM_2026_WITH_VACATION) / VACATION_DAYS_BASE; // ≈ 5.1429

/** Пилотный отчётный период: сентябрь — декабрь 2026 */
export const PERIOD = {
  label: "Сентябрь — декабрь 2026",
  start: "2026-09-01",
  end: "2026-12-31",
  normHours: 618.2,
  months: [
    { year: 2026, month: 9, label: "Сентябрь" },
    { year: 2026, month: 10, label: "Октябрь" },
    { year: 2026, month: 11, label: "Ноябрь" },
    { year: 2026, month: 12, label: "Декабрь" },
  ],
};

/** Опорная дата цикла 2/2: с неё группа 1 выходит на смену */
export const CYCLE_ANCHOR = "2026-09-01";

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** Работает ли группа в этот день по циклу «два через два» */
export function isWorkingDay(dateISO: string, group: number): boolean {
  const diff = daysBetween(CYCLE_ANCHOR, dateISO);
  const idx = ((diff % 4) + 4) % 4;
  const groupOneWorks = idx === 0 || idx === 1;
  return group === 1 ? groupOneWorks : !groupOneWorks;
}

export function monthDays(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** Все календарные даты подтвержденных отпусков сотрудника внутри периода */
export function vacationDatesInRange(
  vacations: { start_date: string; end_date: string; status?: string }[],
  from: string,
  to: string,
): Set<string> {
  const set = new Set<string>();
  for (const v of vacations) {
    if (v.status === "rejected") continue;
    // Для расчёта нормы используем только подтвержденные отпуска
    if (v.status === "pending") continue; 

    const start = parseISO(v.start_date);
    const end = parseISO(v.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISO(d);
      if (iso >= from && iso <= to) set.add(iso);
    }
  }
  return set;
}

/** Пересчёт индивидуальной нормы за период с учётом дней отпуска */
export function personalNorm(
  vacationDaysInPeriod: number,
  baseNorm = PERIOD.normHours,
  nonWorkingHolidaysCount = 0
): number {
  // Каждый нерабочий праздничный день уменьшает норму на SHIFT_WORK_HOURS (11ч)
  const holidayReduction = nonWorkingHolidaysCount * SHIFT_WORK_HOURS;
  return Math.max(0, baseNorm - vacationDaysInPeriod * HOURS_PER_VACATION_DAY - holidayReduction);
}

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function formatHours(n: number): string {
  return n.toFixed(1).replace(".", ",");
}
