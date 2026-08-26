import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

type LegendItem = { label: string; swatch: string; hint: string };

const shiftItems: LegendItem[] = [
  { label: "Группа 1", swatch: "bg-shift-a", hint: "Смена первой группы по графику 2/2." },
  { label: "Группа 2", swatch: "bg-shift-b", hint: "Смена второй группы по графику 2/2." },
  { label: "Смена завершена", swatch: "bg-emerald-600", hint: "Рабочий день уже закончился (после 20:00)." },
  {
    label: "Текущая смена",
    swatch: "bg-gradient-to-r from-emerald-600 via-emerald-400 to-muted",
    hint: "Идёт прямо сейчас: заливка показывает, сколько времени прошло.",
  },
  { label: "Праздничный день", swatch: "bg-holiday", hint: "Нерабочий праздничный день — норма часов уменьшается." },
];

function vacationItems(isManager: boolean): LegendItem[] {
  return isManager
    ? [
        { label: "Отпуск в календаре", swatch: "bg-amber-300", hint: "Подтверждённый отпуск сотрудника в сетке графика." },
        { label: "Ожидает решения", swatch: "bg-orange-500", hint: "Заявка подана и ждёт вашего подтверждения." },
        { label: "Подтверждён", swatch: "bg-primary", hint: "Заявка одобрена, дни списаны из остатка." },
        { label: "Отклонён", swatch: "bg-destructive", hint: "Заявка отклонена, дни не списываются." },
      ]
    : [
        { label: "Мой отпуск", swatch: "bg-amber-300", hint: "Ваш подтверждённый отпуск в сетке графика." },
        { label: "На рассмотрении", swatch: "bg-orange-500", hint: "Заявка отправлена, ждёт решения администратора." },
        { label: "Подтверждена", swatch: "bg-primary", hint: "Заявка одобрена, дни списаны из остатка." },
        { label: "Отклонена", swatch: "bg-destructive", hint: "Заявка отклонена, дни остаются в остатке." },
      ];
}

function Row({ item }: { item: LegendItem }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 size-2.5 shrink-0 rounded-[3px] ${item.swatch}`} />
      <div className="leading-tight">
        <div className="text-[11px] font-medium">{item.label}</div>
        <div className="text-muted-foreground text-[10px]">{item.hint}</div>
      </div>
    </div>
  );
}

export function ShiftVacationLegend({ className }: { className?: string }) {
  const { isManager } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={`h-8 gap-1.5 px-2 text-xs ${className ?? ""}`}>
          <Info className="size-3.5" />
          Легенда
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Обозначения</DialogTitle>
          <DialogDescription className="text-xs">
            {isManager
              ? "Цвета смен и статусов заявок всей команды."
              : "Цвета смен и статусов ваших заявок на отпуск."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Смены</div>
            <div className="grid gap-2">
              {shiftItems.map((i) => (
                <Row key={i.label} item={i} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Отпуска</div>
            <div className="grid gap-2">
              {vacationItems(isManager).map((i) => (
                <Row key={i.label} item={i} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
