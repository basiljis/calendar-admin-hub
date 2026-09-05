import { CheckCircle2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttendanceSettings, useMarkAttendance, useTodayAttendance } from "@/hooks/useAttendance";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function AttendanceButton({ className }: { className?: string }) {
  const { enabled } = useAttendanceSettings();
  const { date, shift, mark } = useTodayAttendance();
  const markMut = useMarkAttendance();

  if (!enabled || !shift) return null;

  if (mark) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ${className ?? ""}`}
        title={mark.source === "auto" ? "Отметка поставлена автоматически" : "Отметка поставлена вручную"}
      >
        <CheckCircle2 className="size-4" />
        Был в {timeOf(mark.marked_at)}
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      className={className}
      disabled={markMut.isPending}
      onClick={() => markMut.mutate({ date, source: "manual" })}
    >
      <UserCheck className="size-4" />
      Отметиться
    </Button>
  );
}
