import { Card, CardContent } from "@/components/ui/card";
import { HelpHint } from "@/components/Hint";

const shiftItems = [
  { label: "Группа 1", color: "bg-shift-a" },
  { label: "Группа 2", color: "bg-shift-b" },
  { label: "Смена завершена", color: "bg-emerald-600" },
  { label: "Текущая смена (заливка)", color: "bg-gradient-to-r from-emerald-600 to-shift-a" },
  { label: "Праздничный день", color: "bg-holiday" },
];

const vacationItems = [
  { label: "День отпуска в календаре", color: "bg-amber-100 border border-amber-200" },
  { label: "Ожидает подтверждения", color: "bg-amber-100 border border-amber-200" },
  { label: "Подтверждён", color: "bg-primary" },
  { label: "Отклонён", color: "bg-destructive" },
];

export function ShiftVacationLegend({ className }: { className?: string }) {
  return (
    <Card className={`border-none shadow-sm bg-card/50 backdrop-blur ${className ?? ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground/90">
              <span>Смены</span>
              <HelpHint text="Цвета групп и реального статуса смены в текущий момент." />
            </div>
            <div className="flex flex-wrap gap-3">
              {shiftItems.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className={`size-3 rounded ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground/90">
              <span>Отпуска</span>
              <HelpHint text="Статусы заявок на отпуск и их цвета в таблицах и календаре." />
            </div>
            <div className="flex flex-wrap gap-3">
              {vacationItems.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className={`size-3 rounded ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
