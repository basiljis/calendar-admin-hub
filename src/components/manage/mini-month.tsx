import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WD = ["П", "В", "С", "Ч", "П", "С", "В"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function MiniMonth({
  year,
  month,
  selected,
  today,
  workDays,
  vacationDays,
  holidays,
  onPickDay,
  onShiftMonth,
}: {
  year: number;
  month: number;
  selected: string;
  today: string;
  workDays: Set<string>;
  vacationDays: Set<string>;
  holidays: Set<string>;
  onPickDay: (date: string) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const prevLast = new Date(year, month - 1, 0).getDate();
  const cells: Array<{ key: string; label: number; date?: string; muted: boolean }> = [];

  for (let i = 0; i < leading; i++) {
    cells.push({ key: `p${i}`, label: prevLast - leading + 1 + i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `d${d}`, label: d, date: iso(year, month, d), muted: false });
  }
  while (cells.length % 7 !== 0) {
    const n = cells.length - leading - daysInMonth + 1;
    cells.push({ key: `n${n}`, label: n, muted: true });
  }

  return (
    <div className="bg-card rounded-2xl border p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            onClick={() => onShiftMonth(-1)}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            onClick={() => onShiftMonth(1)}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WD.map((w, i) => (
          <div
            key={`${w}${i}`}
            className="text-muted-foreground py-1 text-center text-[10px] font-semibold uppercase"
          >
            {w}
          </div>
        ))}
        {cells.map((c) => {
          if (!c.date) {
            return (
              <div key={c.key} className="text-muted-foreground/40 py-1 text-center text-xs">
                {c.label}
              </div>
            );
          }
          const isToday = c.date === today;
          const isSelected = c.date === selected;
          const hasWork = workDays.has(c.date);
          const hasVac = vacationDays.has(c.date);
          const isHoliday = holidays.has(c.date);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPickDay(c.date!)}
              aria-current={isSelected ? "date" : undefined}
              className={`relative flex aspect-square items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold"
                  : isToday
                    ? "border-primary text-primary border font-semibold"
                    : isHoliday
                      ? "bg-holiday/50 text-holiday-foreground"
                      : "hover:bg-muted"
              }`}
            >
              {c.label}
              {(hasWork || hasVac) && !isSelected && (
                <span
                  className={`absolute bottom-0.5 size-1 rounded-full ${
                    hasVac ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
