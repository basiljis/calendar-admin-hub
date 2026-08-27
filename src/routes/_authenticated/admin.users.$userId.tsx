import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/lib/notify";
import {
  ArrowLeft,
  UserRound,
  CalendarDays,
  Palmtree,
  Bell,
  History,
  Lock,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import {
  getUserDetailAdmin,
  updateUserProfileAdmin,
  setUserRoles,
  deleteUserAdmin,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  head: () => ({
    meta: [
      { title: "Профиль пользователя — График ОКП" },
      {
        name: "description",
        content:
          "Детальная страница пользователя: редактирование профиля, роли, смены, отпуска и журнал действий.",
      },
      { property: "og:title", content: "Профиль пользователя — График ОКП" },
      { property: "og:description", content: "Карточка пользователя в системе графиков ОКП." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminUserDetailPage,
});

const roleLabels: Record<AppRole, string> = {
  admin: "Администратор",
  manager: "Руководитель",
  employee: "Сотрудник",
};

const allRoles: AppRole[] = ["admin", "manager", "employee"];

const vacationStatus: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  planned: { label: "На рассмотрении", variant: "secondary" },
  approved: { label: "Подтвержден", variant: "default" },
  rejected: { label: "Отклонен", variant: "destructive" },
};

const shiftTypeLabels: Record<string, string> = {
  work: "Рабочая смена",
  vacation: "Отпуск",
  sick: "Больничный",
  off: "Выходной",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ru-RU");
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getUserDetailAdmin);
  const saveProfile = useServerFn(updateUserProfileAdmin);
  const saveRoles = useServerFn(setUserRoles);
  const removeUser = useServerFn(deleteUserAdmin);

  const [form, setForm] = useState<null | {
    full_name: string;
    phone: string;
    position: string;
    shift_group: number;
  }>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => fetchDetail({ data: { userId } }),
    enabled: isAdmin,
  });

  const profileMutation = useMutation({
    mutationFn: (vars: {
      userId: string;
      full_name: string;
      phone: string | null;
      position: string | null;
      shift_group: number;
    }) => saveProfile({ data: vars }),
    onSuccess: () => {
      toast.success("Профиль сохранен");
      qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rolesMutation = useMutation({
    mutationFn: (vars: { userId: string; roles: AppRole[] }) => saveRoles({ data: vars }),
    onSuccess: () => {
      toast.success("Роли обновлены");
      qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Пользователь удален");
      window.history.back();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || isLoading) {
    return <p className="p-6 text-muted-foreground">Загрузка…</p>;
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" /> Доступ запрещен
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Раздел администрирования доступен только администраторам.
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return <p className="p-6 text-muted-foreground">Пользователь не найден.</p>;
  }

  const p = data.profile;
  const current = form ?? {
    full_name: p.full_name,
    phone: p.phone ?? "",
    position: p.position ?? "",
    shift_group: p.shift_group,
  };

  const approvedDays = data.vacations
    .filter((v: any) => v.status === "approved")
    .reduce((sum: number, v: any) => {
      const days =
        (new Date(v.end_date).getTime() - new Date(v.start_date).getTime()) / 86400000 + 1;
      return sum + days;
    }, 0);

  const shiftHours = data.shifts
    .filter((s: any) => s.type === "work")
    .reduce((sum: number, s: any) => sum + Number(s.hours ?? 0), 0);

  function toggleRole(role: AppRole) {
    const next = data!.roles.includes(role)
      ? data!.roles.filter((r) => r !== role)
      : [...data!.roles, role];
    if (next.length === 0) {
      toast.error("У пользователя должна остаться хотя бы одна роль");
      return;
    }
    rolesMutation.mutate({ userId, roles: next });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="-ml-2 mb-1">
              <ArrowLeft className="size-4" /> К списку пользователей
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <UserRound className="size-6 text-primary" /> {p.full_name || "Без имени"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {p.email ?? "без email"} · зарегистрирован {fmt(p.created_at)}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={userId === user?.id || deleteMutation.isPending}
          onClick={() => {
            if (window.confirm(`Удалить пользователя «${p.full_name}»? Действие необратимо.`)) {
              deleteMutation.mutate();
            }
          }}
        >
          <Trash2 className="size-4" /> Удалить аккаунт
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Редактирование профиля</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ФИО</Label>
                <Input
                  value={current.full_name}
                  onChange={(e) => setForm({ ...current, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  value={current.phone}
                  onChange={(e) => setForm({ ...current, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Должность</Label>
                <Input
                  value={current.position}
                  onChange={(e) => setForm({ ...current, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Группа смен (1 или 2)</Label>
                <Input
                  type="number"
                  min={1}
                  max={2}
                  value={current.shift_group}
                  onChange={(e) => setForm({ ...current, shift_group: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button
              disabled={profileMutation.isPending}
              onClick={() =>
                profileMutation.mutate({
                  userId,
                  full_name: current.full_name.trim(),
                  phone: current.phone.trim() || null,
                  position: current.position.trim() || null,
                  shift_group: current.shift_group,
                })
              }
            >
              <Save className="size-4" /> Сохранить
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Роли доступа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allRoles.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={data.roles.includes(role)}
                  disabled={rolesMutation.isPending}
                  onCheckedChange={() => toggleRole(role)}
                />
                {roleLabels[role]}
              </label>
            ))}
            <div className="pt-3 text-sm text-muted-foreground">
              <p>
                Использовано отпуска: <span className="font-semibold">{approvedDays} дн.</span> из 56
              </p>
              <p>
                Часов по сменам: <span className="font-semibold">{shiftHours}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palmtree className="size-5" /> Отпуска ({data.vacations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.vacations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Заявок на отпуск нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Период</TableHead>
                  <TableHead>Дней</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.vacations.map((v: any) => {
                  const st = vacationStatus[v.status] ?? {
                    label: v.status,
                    variant: "outline" as const,
                  };
                  const days =
                    (new Date(v.end_date).getTime() - new Date(v.start_date).getTime()) /
                      86400000 +
                    1;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        {fmt(v.start_date)} — {fmt(v.end_date)}
                      </TableCell>
                      <TableCell>{days}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.note ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" /> Последние смены ({data.shifts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Смены не сгенерированы.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Часы</TableHead>
                  <TableHead>Перерыв</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.shifts.slice(0, 20).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{fmt(s.work_date)}</TableCell>
                    <TableCell>{shiftTypeLabels[s.type] ?? s.type}</TableCell>
                    <TableCell>{s.type === "work" ? s.hours : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.break_time ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" /> Журнал заявок на отпуск
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Записей нет.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.audit.map((l: any) => (
                  <li key={l.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      {l.action_type === "approve"
                        ? "Подтверждение"
                        : l.action_type === "reject"
                          ? "Отклонение"
                          : l.action_type}{" "}
                      — {l.actor}
                    </p>
                    <p className="text-muted-foreground">
                      {fmtDateTime(l.created_at)}
                      {l.previous_status && l.new_status && (
                        <>
                          {" "}
                          · {l.previous_status} → {l.new_status}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5" /> Последние уведомления
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Уведомлений нет.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.notifications.map((n: any) => (
                  <li key={n.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      {n.title}{" "}
                      {!n.read && (
                        <Badge variant="secondary" className="ml-1">
                          новое
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
