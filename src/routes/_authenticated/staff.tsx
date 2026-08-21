import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plane, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { PERIOD, formatHours, personalNorm, vacationDatesInRange } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Сотрудники — График ОКП" },
      {
        name: "description",
        content: "Карточки психологов ОКП: контакты, группа смен, роли доступа и отпуска.",
      },
      { property: "og:title", content: "Сотрудники — График ОКП" },
      { property: "og:description", content: "Управление составом смен, ролями и отпусками." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StaffPage,
});

const roleLabels: Record<AppRole, string> = {
  admin: "Администратор",
  manager: "Руководитель",
  employee: "Сотрудник",
};

function StaffPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [vacUser, setVacUser] = useState("");
  const [vacFrom, setVacFrom] = useState("");
  const [vacTo, setVacTo] = useState("");

  const { data } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [profiles, roles, vacations, shifts] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("*"),
        supabase.from("vacations").select("*").order("start_date"),
        supabase
          .from("shifts")
          .select("user_id, hours, type")
          .gte("work_date", PERIOD.start)
          .lte("work_date", PERIOD.end),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        vacations: vacations.data ?? [],
        shifts: shifts.data ?? [],
      };
    },
  });

  const profiles = data?.profiles ?? [];

  const updateProfile = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { shift_group?: number } }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addVacation = useMutation({
    mutationFn: async ({ userId, from, to }: { userId: string; from: string; to: string }) => {
      const { error } = await supabase
        .from("vacations")
        .insert({
          user_id: userId,
          start_date: from,
          end_date: to,
          status: isAdmin ? "approved" : "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isAdmin ? "Отпуск добавлен и подтвержден" : "Заявка на отпуск отправлена");
      setVacFrom("");
      setVacTo("");
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["my-period"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateVacationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("vacations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Статус отпуска обновлен");
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeVacation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vacations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Сотрудники</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Состав групп, контакты и индивидуальная норма за период {PERIOD.label}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {profiles.map((p) => {
          const roles = (data?.roles ?? [])
            .filter((r) => r.user_id === p.id)
            .map((r) => r.role as AppRole);
          const vacs = (data?.vacations ?? []).filter((v) => v.user_id === p.id);
          const vacDays = vacationDatesInRange(vacs, PERIOD.start, PERIOD.end).size;
          const norm = personalNorm(vacDays);
          const planned = (data?.shifts ?? [])
            .filter((s) => s.user_id === p.id && s.type === "work")
            .reduce((a, s) => a + Number(s.hours), 0);
          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{p.full_name || "Без имени"}</span>
                  <span className="flex gap-1">
                    {roles.map((r) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                        {roleLabels[r]}
                      </Badge>
                    ))}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-muted-foreground grid grid-cols-2 gap-2">
                  <span>{p.email ?? "—"}</span>
                  <span>{p.phone ?? "телефон не указан"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Норма" value={`${formatHours(norm)} ч`} />
                  <Metric label="План" value={`${formatHours(planned)} ч`} />
                  <Metric label="Отпуск" value={`${vacDays} дн.`} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground text-xs">Группа</Label>
                  <Select
                    disabled={!isAdmin}
                    value={String(p.shift_group)}
                    onValueChange={(v) =>
                      updateProfile.mutate({ id: p.id, patch: { shift_group: Number(v) } })
                    }
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Группа 1</SelectItem>
                      <SelectItem value="2">Группа 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {vacs.length > 0 && (
                  <div className="space-y-1">
                    {vacs.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                          v.status === "approved"
                            ? "bg-secondary/60"
                            : v.status === "rejected"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5">
                            <Plane className="size-3" />
                            {v.start_date.split("-").reverse().join(".")} —{" "}
                            {v.end_date.split("-").reverse().join(".")}
                          </span>
                          <span className="text-[9px] uppercase font-bold opacity-70">
                            {v.status === "approved"
                              ? "Подтвержден"
                              : v.status === "rejected"
                                ? "Отклонен"
                                : "Ожидает"}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {isAdmin && v.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateVacationStatus.mutate({ id: v.id, status: "approved" })}
                                className="text-green-600 hover:text-green-700"
                                title="Подтвердить"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => updateVacationStatus.mutate({ id: v.id, status: "rejected" })}
                                className="text-red-600 hover:text-red-700"
                                title="Отклонить"
                              >
                                ✕
                              </button>
                            </>
                          )}
                          {(isAdmin || (user?.id === p.id && v.status === "pending")) && (
                            <button
                              onClick={() => removeVacation.mutate(v.id)}
                              aria-label="Удалить отпуск"
                              className="opacity-50 hover:opacity-100"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAdmin ? "Добавить или назначить отпуск" : "Подать заявку на отпуск"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Сотрудник</Label>
              <Select
                value={vacUser || (isAdmin ? "" : user?.id)}
                disabled={!isAdmin}
                onValueChange={setVacUser}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email || p.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">С</Label>
              <Input
                type="date"
                value={vacFrom}
                onChange={(e) => setVacFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">По</Label>
              <Input type="date" value={vacTo} onChange={(e) => setVacTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => {
                  const targetUser = isAdmin ? vacUser : user?.id;
                  if (!targetUser || !vacFrom || !vacTo) {
                    toast.error("Заполните все поля");
                    return;
                  }
                  addVacation.mutate({ userId: targetUser, from: vacFrom, to: vacTo });
                }}
                disabled={addVacation.isPending}
              >
                {isAdmin ? "Добавить" : "Отправить"}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            {isAdmin
              ? "Администратор добавляет подтвержденные отпуска. Сотрудник подает заявку на рассмотрение."
              : "Ваша заявка будет рассмотрена администратором. Только после подтверждения норма часов будет пересчитана."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-md py-2">
      <div className="text-muted-foreground text-[11px]">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
