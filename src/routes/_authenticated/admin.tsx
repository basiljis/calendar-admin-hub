import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Trash2, Pencil, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import {
  listUsersWithRoles,
  setUserRoles,
  updateUserProfileAdmin,
  deleteUserAdmin,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Администрирование — График ОКП" },
      {
        name: "description",
        content:
          "Панель администратора: управление пользователями, ролями доступа и данными профилей психологов ОКП.",
      },
      { property: "og:title", content: "Администрирование — График ОКП" },
      {
        property: "og:description",
        content: "Управление пользователями и ролями доступа в системе графиков ОКП.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const roleLabels: Record<AppRole, string> = {
  admin: "Администратор",
  manager: "Руководитель",
  employee: "Сотрудник",
};

const allRoles: AppRole[] = ["admin", "manager", "employee"];

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();

  const fetchUsers = useServerFn(listUsersWithRoles);
  const saveRoles = useServerFn(setUserRoles);
  const saveProfile = useServerFn(updateUserProfileAdmin);
  const removeUser = useServerFn(deleteUserAdmin);

  const [editing, setEditing] = useState<null | {
    id: string;
    full_name: string;
    phone: string;
    position: string;
    shift_group: number;
  }>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const rolesMutation = useMutation({
    mutationFn: (vars: { userId: string; roles: AppRole[] }) => saveRoles({ data: vars }),
    onSuccess: () => {
      toast.success("Роли обновлены");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Пользователь удален");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleRole(userId: string, current: AppRole[], role: AppRole) {
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    if (next.length === 0) {
      toast.error("У пользователя должна остаться хотя бы одна роль");
      return;
    }
    rolesMutation.mutate({ userId, roles: next });
  }

  if (loading) {
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
          Раздел администрирования доступен только администраторам системы.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6 text-primary" /> Администрирование
        </h1>
        <p className="text-sm text-muted-foreground">
          Управление пользователями и ролями доступа. Доступно только администраторам.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка списка пользователей…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Контакты</TableHead>
                    <TableHead>Должность</TableHead>
                    <TableHead>Группа</TableHead>
                    <TableHead>Роли</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name}
                        {u.id === user?.id && (
                          <Badge variant="secondary" className="ml-2">
                            это вы
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{u.email ?? "—"}</div>
                        <div>{u.phone ?? "—"}</div>
                      </TableCell>
                      <TableCell>{u.position ?? "—"}</TableCell>
                      <TableCell>{u.shift_group}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {allRoles.map((role) => (
                            <label key={role} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={u.roles.includes(role)}
                                disabled={rolesMutation.isPending}
                                onCheckedChange={() =>
                                  toggleRole(u.id, u.roles as AppRole[], role)
                                }
                              />
                              {roleLabels[role]}
                            </label>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setEditing({
                                id: u.id,
                                full_name: u.full_name,
                                phone: u.phone ?? "",
                                position: u.position ?? "",
                                shift_group: u.shift_group,
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={u.id === user?.id || deleteMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Удалить пользователя «${u.full_name}»? Действие необратимо.`,
                                )
                              ) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование профиля</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ФИО</Label>
                <Input
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Должность</Label>
                <Input
                  value={editing.position}
                  onChange={(e) => setEditing({ ...editing, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Группа смен (1 или 2)</Label>
                <Input
                  type="number"
                  min={1}
                  max={2}
                  value={editing.shift_group}
                  onChange={(e) =>
                    setEditing({ ...editing, shift_group: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button
              disabled={profileMutation.isPending}
              onClick={() =>
                editing &&
                profileMutation.mutate({
                  userId: editing.id,
                  full_name: editing.full_name.trim(),
                  phone: editing.phone.trim() || null,
                  position: editing.position.trim() || null,
                  shift_group: editing.shift_group === 2 ? 2 : 1,
                })
              }
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
