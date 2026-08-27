import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

export function VacationRequestDialog({ className }: { className?: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  const days =
    startDate && endDate && endDate >= startDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
        ) + 1
      : 0;

  const submit = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) throw new Error("Укажите даты начала и окончания");
      if (endDate < startDate) throw new Error("Дата окончания раньше даты начала");

      const { data: created, error } = await supabase
        .from("vacations")
        .insert({
          user_id: user!.id,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
          note: note || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("vacation_audit_logs").insert({
        vacation_id: created.id,
        action_by: user!.id,
        action_type: "requested",
        previous_status: null,
        new_status: "pending",
      });

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            title: "Новая заявка на отпуск",
            message: `${profile?.full_name || "Сотрудник"} запросил отпуск с ${startDate
              .split("-")
              .reverse()
              .join(".")} по ${endDate.split("-").reverse().join(".")} (${days} дн.).`,
            type: "info",
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success("Заявка отправлена администратору");
      setOpen(false);
      setStartDate("");
      setEndDate("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["my-vacations"] });
      qc.invalidateQueries({ queryKey: ["admin-vacations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className}>
          <Plane className="mr-2 size-4" />
          Запросить отпуск
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Заявка на отпуск</DialogTitle>
          <DialogDescription>
            Укажите период отпуска. Заявку рассмотрит администратор, вы получите уведомление.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Дата начала</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Дата окончания</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Комментарий</label>
            <Textarea
              placeholder="Например: ежегодный оплачиваемый отпуск"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {days > 0 && (
            <p className="text-sm text-muted-foreground">
              Продолжительность: <span className="font-medium text-foreground">{days} дн.</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Отправка..." : "Отправить заявку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
