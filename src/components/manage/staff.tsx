import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { Plane, Trash2, History, Mail, Phone, UserPlus, Power, PowerOff, ShieldCheck, ShieldQuestion, FileSpreadsheet } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { createUserAdmin, setUserActive, setUserApproved } from "@/lib/admin-users.functions";
import { PERIOD, formatHours, personalNorm, vacationDatesInRange } from "@/lib/schedule";
import { usePositions, useShiftGroups } from "@/components/settings/Directories";
import { exportToExcel } from "@/lib/export";
import { recordEvent } from "@/lib/log-client";


const roleLabels: Record<AppRole, string> = {
  admin: "Администратор",
  manager: "Руководитель",
  employee: "Сотрудник",
};

const allRoles: AppRole[] = ["admin", "manager", "employee"];

function humanizeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/at least 8|too_small.*password|Password should be at least/i.test(raw)) return "Пароль должен содержать минимум 8 символов";
  if (/invalid.*email|email.*invalid/i.test(raw)) return "Некорректный адрес электронной почты";
  if (/already been registered|already exists|duplicate key/i.test(raw)) return "Пользователь с такой почтой уже существует";
  if (raw.trim().startsWith("[") || raw.trim().startsWith("{")) return "Проверьте правильность заполнения полей";
  return raw;
}

export function StaffPage() {
  const { isAdmin, isManager, user } = useAuth();
  const qc = useQueryClient();
  const createUser = useServerFn(createUserAdmin);
  const [addOpen, setAddOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const groupsQuery = useShiftGroups();
  const positionsQuery = usePositions();
  const activeGroups = (groupsQuery.data ?? []).filter((g) => g.is_active);
  const activePositions = (positionsQuery.data ?? []).filter((p) => p.is_active);

  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "employee" as AppRole, phone: "", position: "", shift_group: "1" });
  const [vacUser, setVacUser] = useState("");
  const [vacFrom, setVacFrom] = useState("");
  const [vacTo, setVacTo] = useState("");

  const { data } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
        const [profiles, roles, vacations, shifts, auditLogs] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("*"),
        supabase.from("vacations").select("*").order("start_date"),
        supabase
          .from("shifts")
          .select("user_id, hours, type")
          .gte("work_date", PERIOD.start)
          .lte("work_date", PERIOD.end),
        supabase
          .from("vacation_audit_logs")
          .select(`
            *,
            action_by_profile:profiles!vacation_audit_logs_action_by_fkey(full_name)
          `)
          .order("created_at", { ascending: false }),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        vacations: vacations.data ?? [],
        shifts: shifts.data ?? [],
        auditLogs: auditLogs.data ?? [],
      };
    },
  });

  const profiles = data?.profiles ?? [];

  const setActiveFn = useServerFn(setUserActive);
  const toggleActive = useMutation({
    mutationFn: async (vars: { userId: string; active: boolean }) =>
      await setActiveFn({ data: vars }),
    onSuccess: (_d, vars) => {
      recordEvent({
        category: "action",
        event: vars.active ? "Активация учётной записи" : "Деактивация учётной записи",
        message: `Учётная запись ${vars.userId} ${vars.active ? "активирована" : "деактивирована"}`,
      });
      toast.success(vars.active ? "Учётная запись активирована" : "Учётная запись деактивирована");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setApprovedFn = useServerFn(setUserApproved);
  const toggleApproved = useMutation({
    mutationFn: async (vars: { userId: string; approved: boolean }) =>
      await setApprovedFn({ data: vars }),
    onSuccess: (_d, vars) => {
      recordEvent({
        category: "action",
        event: vars.approved ? "Подтверждение пользователя" : "Отзыв подтверждения",
        message: `Пользователь ${vars.userId} ${vars.approved ? "подтверждён" : "лишён подтверждения"}`,
      });
      toast.success(vars.approved ? "Пользователь подтверждён" : "Подтверждение отозвано");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      const { data: vacData, error: vacError } = await supabase
        .from("vacations")
        .insert({
          user_id: userId,
          start_date: from,
          end_date: to,
          status: isAdmin ? "approved" : "pending",
        })
        .select()
        .single();
      if (vacError) throw vacError;

      // Add audit log
      if (vacData) {
        await supabase.from("vacation_audit_logs").insert({
          vacation_id: vacData.id,
          action_by: user!.id,
          action_type: isAdmin ? "approved" : "requested",
          new_status: isAdmin ? "approved" : "pending"
        });
      }

      // If employee requesting vacation, notify admins
      if (!isAdmin) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (admins && admins.length > 0) {
          const profile = profiles.find(p => p.id === userId);
          const userName = profile?.full_name || "Сотрудник";
          
          await Promise.all(admins.map(admin => 
            supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "Новая заявка на отпуск",
              message: `${userName} подал(а) заявку на отпуск с ${from.split('-').reverse().join('.')} по ${to.split('-').reverse().join('.')}`,
              type: "info"
            })
          ));
        }
      }
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
    mutationFn: async ({ id, status, userId, startDate, endDate }: { id: string; status: "approved" | "rejected", userId: string, startDate: string, endDate: string }) => {
      const { error } = await supabase
        .from("vacations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      // Add audit log
      await supabase.from("vacation_audit_logs").insert({
        vacation_id: id,
        action_by: user!.id,
        action_type: status,
        previous_status: "pending",
        new_status: status
      });

      // Notify employee
      const statusText = status === "approved" ? "подтверждена" : "отклонена";
      const notificationType = status === "approved" ? "success" : "error";
      
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `Заявка на отпуск ${statusText}`,
        message: `Ваш отпуск с ${startDate.split('-').reverse().join('.')} по ${endDate.split('-').reverse().join('.')} был ${statusText} администратором.`,
        type: notificationType
      });
    },
    onSuccess: (_d, vars) => {
      recordEvent({
        category: "action",
        event: vars.status === "approved" ? "Отпуск подтверждён" : "Отпуск отклонён",
        message: `Отпуск ${vars.startDate} — ${vars.endDate}`,
      });
      toast.success("Статус отпуска обновлен");
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeVacation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vacations").delete().eq("id", id);
      if (error) throw error;

      // Log deletion (optional, but good for audit)
      // Note: CASCADE handles deleting logs, but if we want to log the action we'd need to do it before deletion or use a soft delete
      // For now, we'll just delete, as cascade handles cleanup.
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = () => {
    const staffRows = profiles.map((p) => {
      const roles = (data?.roles ?? [])
        .filter((r) => r.user_id === p.id)
        .map((r) => roleLabels[r.role as AppRole] ?? r.role)
        .join(", ");
      const vacs = (data?.vacations ?? []).filter((v) => v.user_id === p.id);
      const vacDays = vacationDatesInRange(vacs, PERIOD.start, PERIOD.end).size;
      const planned = (data?.shifts ?? [])
        .filter((s) => s.user_id === p.id && s.type === "work")
        .reduce((a, s) => a + Number(s.hours), 0);
      return {
        "ФИО": p.full_name ?? "",
        "Почта": p.email ?? "",
        "Телефон": p.phone ?? "",
        "Должность": p.position ?? "",
        "Группа": p.shift_group ?? "",
        "Роли": roles,
        "Статус": (p as any).is_active === false ? "Отключён" : "Активен",
        "Подтверждён": (p as any).is_approved === false ? "Нет" : "Да",
        "Норма, ч": Number(formatHours(personalNorm(vacDays)).replace(",", ".")),
        "План, ч": Number(planned.toFixed(1)),
        "Отпуск, дн": vacDays,
      };
    });
    const vacationRows = (data?.vacations ?? []).map((v) => ({
      "Сотрудник": profiles.find((p) => p.id === v.user_id)?.full_name ?? "",
      "С": v.start_date.split("-").reverse().join("."),
      "По": v.end_date.split("-").reverse().join("."),
      "Статус": v.status === "approved" ? "Подтверждён" : v.status === "rejected" ? "Отклонён" : "Ожидает",
    }));
    exportToExcel(
      [
        { name: "Сотрудники", rows: staffRows },
        { name: "Отпуска", rows: vacationRows },
      ],
      `Сотрудники_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success("Файл Excel сформирован");
  };

  return (
    <div className="space-y-8">
      {(isAdmin || isManager) && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport}><FileSpreadsheet className="mr-2 size-4" />Выгрузить в Excel</Button>
          <Button className="w-full sm:w-auto" onClick={() => setAddOpen(true)}><UserPlus className="mr-2 size-4" />Добавить пользователя</Button>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setFormErrors({}); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый пользователь</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>ФИО <span className="text-destructive">*</span>
              <Input aria-invalid={!!formErrors["full_name"]} className={formErrors["full_name"] ? "border-destructive focus-visible:ring-destructive" : ""} value={newUser.full_name} onChange={(e) => { setNewUser({ ...newUser, full_name: e.target.value }); setFormErrors((p) => ({ ...p, full_name: "" })); }} />
              {formErrors["full_name"] && <span className="text-xs font-normal text-destructive">{formErrors["full_name"]}</span>}
            </Label>
            <Label>Электронная почта <span className="text-destructive">*</span>
              <Input type="email" aria-invalid={!!formErrors["email"]} className={formErrors["email"] ? "border-destructive focus-visible:ring-destructive" : ""} value={newUser.email} onChange={(e) => { setNewUser({ ...newUser, email: e.target.value }); setFormErrors((p) => ({ ...p, email: "" })); }} />
              {formErrors["email"] && <span className="text-xs font-normal text-destructive">{formErrors["email"]}</span>}
            </Label>
            <Label>Пароль <span className="text-destructive">*</span>
              <Input type="password" minLength={8} aria-invalid={!!formErrors["password"]} className={formErrors["password"] ? "border-destructive focus-visible:ring-destructive" : ""} value={newUser.password} onChange={(e) => { setNewUser({ ...newUser, password: e.target.value }); setFormErrors((p) => ({ ...p, password: "" })); }} />
              <span className="text-xs font-normal text-muted-foreground">Минимум 8 символов</span>
              {formErrors["password"] && <span className="text-xs font-normal text-destructive">{formErrors["password"]}</span>}
            </Label>
            <Label>Роль <span className="text-destructive">*</span><Select value={newUser.role} onValueChange={(role: AppRole) => setNewUser({ ...newUser, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allRoles.filter((role) => isAdmin || role === "employee").map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent></Select></Label>
            <Label>Смена (группа)
              <Select value={newUser.shift_group} onValueChange={(v) => setNewUser({ ...newUser, shift_group: v })}>
                <SelectTrigger aria-label="Группа смены нового сотрудника"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeGroups.map((g) => <SelectItem key={g.id} value={String(g.number)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs font-normal text-muted-foreground">Можно выбрать сейчас или изменить позже в таблице сотрудников.</span>
            </Label>

            <Label>Телефон
              <Input aria-invalid={!!formErrors["phone"]} className={formErrors["phone"] ? "border-destructive focus-visible:ring-destructive" : ""} value={newUser.phone} onChange={(e) => { setNewUser({ ...newUser, phone: e.target.value }); setFormErrors((p) => ({ ...p, phone: "" })); }} />
              {formErrors["phone"] && <span className="text-xs font-normal text-destructive">{formErrors["phone"]}</span>}
            </Label>
            <Label>Должность
              <Select value={newUser.position} onValueChange={(v) => setNewUser({ ...newUser, position: v })}>
                <SelectTrigger aria-label="Должность нового сотрудника"><SelectValue placeholder="Выберите должность" /></SelectTrigger>
                <SelectContent>
                  {activePositions.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs font-normal text-muted-foreground">Список настраивается в разделе «Настройки → Система».</span>
            </Label>

            <p className="text-xs text-muted-foreground">Поля, отмеченные <span className="text-destructive">*</span>, обязательны для заполнения.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button><Button onClick={() => {
            const email = newUser.email.trim().toLowerCase();
            const errors: Record<string, string> = {};
            if (!newUser.full_name.trim()) errors["full_name"] = "Укажите ФИО";
            else if (newUser.full_name.trim().length < 2) errors["full_name"] = "ФИО слишком короткое";
            if (!email) errors["email"] = "Укажите электронную почту";
            else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors["email"] = "Некорректный адрес электронной почты";
            else if (profiles.some((p) => (p.email ?? "").trim().toLowerCase() === email)) errors["email"] = "Пользователь с такой почтой уже существует";
            if (!newUser.password) errors["password"] = "Укажите пароль";
            else if (newUser.password.length < 8) errors["password"] = "Пароль должен содержать минимум 8 символов";
            if (newUser.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(newUser.phone.trim())) errors["phone"] = "Некорректный номер телефона";
            setFormErrors(errors);
            if (Object.keys(errors).length > 0) { toast.error(Object.values(errors)[0] ?? "Проверьте правильность заполнения полей"); return; }
            createUser({ data: { ...newUser, email, full_name: newUser.full_name.trim(), phone: newUser.phone.trim() || null, position: newUser.position.trim() || null, shift_group: Number(newUser.shift_group) } }).then(() => { toast.success("Пользователь добавлен"); setAddOpen(false); setFormErrors({}); setNewUser({ email: "", password: "", full_name: "", role: "employee" as AppRole, phone: "", position: "", shift_group: "1" }); qc.invalidateQueries({ queryKey: ["staff"] }); }).catch((e: Error) => { const msg = humanizeError(e); if (/почтой уже существует/.test(msg)) setFormErrors({ email: msg }); toast.error(msg); });
          }}>Создать</Button></DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="overflow-hidden rounded-3xl border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Сотрудник</TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Контакты</TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Группа</TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Статус</TableHead>
                <TableHead className="py-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Норма</TableHead>
                <TableHead className="py-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">План</TableHead>
                <TableHead className="py-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Отпуск</TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Отпуска</TableHead>
                {isAdmin && <TableHead className="py-4 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
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
                const pendingCount = vacs.filter((v) => v.status === "pending").length;
                return (
                  <TableRow key={p.id} className="align-middle transition-colors hover:bg-muted/30">
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-base font-semibold leading-tight">{p.full_name || "Без имени"}</span>
                        <span className="flex flex-wrap gap-1">
                          {roles.map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="rounded-full px-2.5">
                              {roleLabels[r]}
                            </Badge>
                          ))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3 shrink-0" />
                          {p.email ?? "—"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3 shrink-0" />
                          {p.phone ?? "не указан"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={!isAdmin}
                        value={String(p.shift_group)}
                        onValueChange={(v) =>
                          updateProfile.mutate({ id: p.id, patch: { shift_group: Number(v) } })
                        }
                      >
                        <SelectTrigger className="h-8 w-28" aria-label={`Группа сотрудника ${p.full_name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activeGroups.map((g) => (
                            <SelectItem key={g.id} value={String(g.number)}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`rounded-full border-0 px-2.5 py-0.5 text-[10px] ${
                            (p as any).is_active === false
                              ? "bg-destructive/15 text-destructive"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {(p as any).is_active === false ? "Отключён" : "Активен"}
                        </Badge>
                        {(p as any).is_approved === false && (
                          <Badge className="border-0 bg-amber-100 text-[10px] text-amber-800 rounded-full">
                            Ждёт подтверждения
                          </Badge>
                        )}
                        {(isAdmin || isManager) && p.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={toggleApproved.isPending}
                            title={
                              (p as any).is_approved === false
                                ? "Подтвердить регистрацию пользователя"
                                : "Отозвать подтверждение регистрации"
                            }
                            aria-label={`Подтверждение регистрации: ${p.full_name}`}
                            onClick={() =>
                              toggleApproved.mutate({
                                userId: p.id,
                                approved: (p as any).is_approved === false,
                              })
                            }
                          >
                            {(p as any).is_approved === false ? (
                              <ShieldQuestion className="size-4 text-amber-600" />
                            ) : (
                              <ShieldCheck className="size-4 text-emerald-600" />
                            )}
                          </Button>
                        )}
                        {(isAdmin || isManager) && p.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={toggleActive.isPending}
                            title={
                              (p as any).is_active === false
                                ? "Активировать учётную запись"
                                : "Деактивировать учётную запись (без удаления)"
                            }
                            aria-label={`Изменить статус учётной записи: ${p.full_name}`}
                            onClick={() =>
                              toggleActive.mutate({
                                userId: p.id,
                                active: (p as any).is_active === false,
                              })
                            }
                          >
                            {(p as any).is_active === false ? (
                              <Power className="size-4 text-emerald-600" />
                            ) : (
                              <PowerOff className="size-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><span className="text-base font-bold tabular-nums">{formatHours(norm)}</span> <span className="text-xs text-muted-foreground">ч</span></TableCell>
                    <TableCell className="text-center"><span className="text-base font-bold tabular-nums">{formatHours(planned)}</span> <span className="text-xs text-muted-foreground">ч</span></TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <Plane className="size-3.5 text-muted-foreground" />
                        <span className="text-base font-bold tabular-nums">{vacDays}</span>
                        <span className="text-xs text-muted-foreground">дн.</span>
                      </span>
                      {pendingCount > 0 && (
                        <Badge className="ml-1 rounded-full bg-amber-100 text-amber-800 border-0 text-[10px]">
                          +{pendingCount} ждёт
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {vacs.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {vacs.map((v) => (
                            <div
                              key={v.id}
                              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs ${
                                v.status === "approved"
                                  ? "bg-secondary/60"
                                  : v.status === "rejected"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 whitespace-nowrap">
                                <Plane className="size-3" />
                                {v.start_date.split("-").reverse().join(".")} —{" "}
                                {v.end_date.split("-").reverse().join(".")}
                                <span className="text-[9px] uppercase font-bold opacity-70">
                                  {v.status === "approved"
                                    ? "Подтверждён"
                                    : v.status === "rejected"
                                      ? "Отклонён"
                                      : "Ожидает"}
                                </span>
                              </span>
                              <span className="flex items-center gap-1">
                                {isAdmin && v.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() =>
                                        updateVacationStatus.mutate({
                                          id: v.id,
                                          status: "approved",
                                          userId: p.id,
                                          startDate: v.start_date,
                                          endDate: v.end_date,
                                        })
                                      }
                                      className="text-green-600 hover:text-green-700"
                                      title="Подтвердить"
                                      aria-label="Подтвердить отпуск"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() =>
                                        updateVacationStatus.mutate({
                                          id: v.id,
                                          status: "rejected",
                                          userId: p.id,
                                          startDate: v.start_date,
                                          endDate: v.end_date,
                                        })
                                      }
                                      className="text-red-600 hover:text-red-700"
                                      title="Отклонить"
                                      aria-label="Отклонить отпуск"
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
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Назначить отпуск"
                            aria-label={`Назначить отпуск: ${p.full_name}`}
                            onClick={() => {
                              setVacUser(p.id);
                              document.getElementById("add-vacation-card")?.scrollIntoView({ behavior: "smooth" });
                              toast.info(`Выбран сотрудник: ${p.full_name}. Укажите даты отпуска ниже.`);
                            }}
                          >
                            <Plane className="size-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Журнал заявок" aria-label={`Журнал заявок: ${p.full_name}`}>
                                <History className="size-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="text-sm">Журнал заявок: {p.full_name}</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-[10px] uppercase">Кто</TableHead>
                                      <TableHead className="text-[10px] uppercase">Действие</TableHead>
                                      <TableHead className="text-[10px] uppercase text-right">Когда</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(data?.auditLogs ?? [])
                                      .filter((log: any) => vacs.some((v) => v.id === log.vacation_id))
                                      .map((log: any) => (
                                        <TableRow key={log.id}>
                                          <TableCell className="text-xs py-2">
                                            {log.action_by_profile?.full_name || "Система"}
                                          </TableCell>
                                          <TableCell className="text-xs py-2">
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                              {log.action_type === "requested"
                                                ? "Подана"
                                                : log.action_type === "approved"
                                                  ? "Подтверждена"
                                                  : log.action_type === "rejected"
                                                    ? "Отклонена"
                                                    : log.action_type === "adjusted"
                                                      ? "Скорректирована"
                                                      : log.action_type}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-xs py-2 text-right text-muted-foreground">
                                            {new Date(log.created_at).toLocaleString("ru-RU", {
                                              day: "2-digit",
                                              month: "2-digit",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    {(data?.auditLogs ?? []).filter((log: any) =>
                                      vacs.some((v) => v.id === log.vacation_id)
                                    ).length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">
                                          Записей не найдено
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Card id="add-vacation-card">
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
                value={vacUser || (isAdmin ? "" : user?.id || "")}
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
