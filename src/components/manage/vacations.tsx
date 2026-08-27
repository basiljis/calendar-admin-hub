import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "@/lib/notify";
import { 
  Plane, 
  Filter, 
  History, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Calendar as CalendarIcon,
  Download,
  CheckSquare,
  Square,
  Pencil
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { Hint } from "@/components/Hint";



export function VacationsAdminPage() {
  const { isAdmin, isManager, user } = useAuth();
  const canManage = isAdmin || isManager;
  const qc = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<string>("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vacations", statusFilter, searchQuery, dateFrom, dateTo],
    queryFn: async () => {
      // First fetch vacations
      let query = supabase
        .from("vacations")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      if (dateFrom) {
        query = query.gte("start_date", dateFrom);
      }
      
      if (dateTo) {
        query = query.lte("end_date", dateTo);
      }

      const { data: vacs, error: vacError } = await query;
      if (vacError) throw vacError;

      // Fetch profiles separately since relationships might not be detected by TS
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      
      if (profError) throw profError;

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      let filteredData = (vacs || []).map(v => ({
        ...v,
        profile: profileMap.get(v.user_id)
      }));

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredData = filteredData.filter(v => 
          v.profile?.full_name?.toLowerCase().includes(lowerQuery) ||
          v.profile?.email?.toLowerCase().includes(lowerQuery)
        );
      }

      return filteredData;
    },
    enabled: canManage,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["vacation-audit-logs-global"],
    queryFn: async () => {
      const { data: logs, error: logError } = await supabase
        .from("vacation_audit_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (logError) throw logError;

      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, full_name");
      
      if (profError) throw profError;

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      return (logs || []).map(log => ({
        ...log,
        action_by_profile: profileMap.get(log.action_by)
      }));
    },
    enabled: canManage,
  });


  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "approved" | "rejected" }) => {
      // Fetch details for notifications and audit
      const { data: vacs, error: fetchError } = await supabase
        .from("vacations")
        .select("*")
        .in("id", ids);
      
      if (fetchError) throw fetchError;
      if (!vacs) return;

      const { error: updateError } = await supabase
        .from("vacations")
        .update({ status })
        .in("id", ids);
      
      if (updateError) throw updateError;

      // Add audit logs and notifications for each
      const auditEntries = ids.map(id => ({
        vacation_id: id,
        action_by: user!.id,
        action_type: status,
        previous_status: "pending",
        new_status: status
      }));

      await supabase.from("vacation_audit_logs").insert(auditEntries);

      const statusText = status === "approved" ? "подтверждена" : "отклонена";
      const notificationType = status === "approved" ? "success" : "error";
      
      const notifications = vacs.map(v => ({
        user_id: v.user_id,
        title: `Заявка на отпуск ${statusText}`,
        message: `Ваш отпуск с ${v.start_date.split('-').reverse().join('.')} по ${v.end_date.split('-').reverse().join('.')} был ${statusText} администратором.`,
        type: notificationType
      }));

      await supabase.from("notifications").insert(notifications);
    },
    onSuccess: () => {
      toast.success("Статус обновлен");
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["admin-vacations"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustRequest = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editStart || !editEnd) throw new Error("Укажите даты");
      if (editEnd < editStart) throw new Error("Дата окончания раньше даты начала");

      const { error } = await supabase
        .from("vacations")
        .update({
          start_date: editStart,
          end_date: editEnd,
          note: editNote || null,
          status: editStatus,
        })
        .eq("id", editing.id);
      if (error) throw error;

      await supabase.from("vacation_audit_logs").insert({
        vacation_id: editing.id,
        action_by: user!.id,
        action_type: editStatus === editing.status ? "adjusted" : editStatus,
        previous_status: editing.status,
        new_status: editStatus,
      });

      await supabase.from("notifications").insert({
        user_id: editing.user_id,
        title: "Заявка на отпуск скорректирована",
        message: `Администратор изменил вашу заявку: период ${editStart
          .split("-")
          .reverse()
          .join(".")} — ${editEnd.split("-").reverse().join(".")}, статус: ${
          editStatus === "approved" ? "подтверждена" : editStatus === "rejected" ? "отклонена" : "ожидает"
        }.`,
        type: "info",
      });
    },
    onSuccess: () => {
      toast.success("Заявка обновлена");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-vacations"] });
      qc.invalidateQueries({ queryKey: ["vacation-audit-logs-global"] });
      qc.invalidateQueries({ queryKey: ["my-vacations"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (v: any) => {
    setEditing(v);
    setEditStart(v.start_date);
    setEditEnd(v.end_date);
    setEditNote(v.note || "");
    setEditStatus(v.status);
  };

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }

    const headers = ["Сотрудник", "Email", "Начало", "Конец", "Статус", "Дата подачи"];
    const csvContent = [
      headers.join(","),
      ...data.map((v: any) => [
        `"${v.profile?.full_name || ''}"`,
        `"${v.profile?.email || ''}"`,
        v.start_date,
        v.end_date,
        v.status,
        new Date(v.created_at).toLocaleDateString("ru-RU")
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vacations_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.map((v: any) => v.id) || []);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (!canManage) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Доступ ограничен</CardTitle>
            <CardDescription>Раздел доступен администраторам и руководителям.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Фильтры</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Поиск сотрудника</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ФИО или Email"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Статус</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидают</SelectItem>
                  <SelectItem value="approved">Подтверждены</SelectItem>
                  <SelectItem value="rejected">Отклонены</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Дата начала (от)</label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-9"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Дата конца (до)</label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-9"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Экспорт CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="text-sm font-medium">
              Выбрано: {selectedIds.length}
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Одобрить выбранные
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Подтверждение массового одобрения</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите одобрить {selectedIds.length} заявок? Это действие нельзя отменить.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => updateStatus.mutate({ ids: selectedIds, status: "approved" })}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Подтвердить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10">
                    <XCircle className="mr-2 h-4 w-4" />
                    Отклонить выбранные
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Подтверждение массового отклонения</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите отклонить {selectedIds.length} заявок?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => updateStatus.mutate({ ids: selectedIds, status: "rejected" })}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Подтвердить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={!!data?.length && selectedIds.length === data.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Дата подачи</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Заявок не найдено
                </TableCell>
              </TableRow>
            ) : (
              data?.map((v: any) => (
                <TableRow key={v.id} className={selectedIds.includes(v.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(v.id)}
                      onCheckedChange={() => toggleSelect(v.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{v.profile?.full_name}</div>
                    <div className="text-xs text-muted-foreground">{v.profile?.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Plane className="size-3.5 text-muted-foreground" />
                      <span>
                        {v.start_date.split("-").reverse().join(".")} —{" "}
                        {v.end_date.split("-").reverse().join(".")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        v.status === "approved"
                          ? "default"
                          : v.status === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                      className={
                        v.status === "pending"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : ""
                      }
                    >
                      {v.status === "approved"
                        ? "Подтвержден"
                        : v.status === "rejected"
                          ? "Отклонен"
                          : "Ожидает"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(v.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="История изменений">
                            <History className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>История заявки: {v.profile?.full_name}</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Кто</TableHead>
                                  <TableHead>Действие</TableHead>
                                  <TableHead className="text-right">Когда</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {auditLogs
                                  .filter((log: any) => log.vacation_id === v.id)
                                  .map((log: any) => (
                                    <TableRow key={log.id}>
                                      <TableCell className="text-sm">
                                        {log.action_by_profile?.full_name || "Система"}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-[10px]">
                                          {log.action_type === "requested" ? "Подана" : 
                                           log.action_type === "approved" ? "Подтверждена" : 
                                           log.action_type === "rejected" ? "Отклонена" :
                                           log.action_type === "adjusted" ? "Скорректирована" : log.action_type}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString("ru-RU")}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Hint
                        side="top"
                        label={v.status === "approved" ? "Изменить подтверждённый отпуск" : "Скорректировать заявку"}
                        description="Доступно администраторам и руководителям: даты, комментарий и статус."
                      >
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                          <Pencil className="size-4" />
                        </Button>
                      </Hint>

                      {v.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Подтвердить отпуск"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => updateStatus.mutate({
                              ids: [v.id],
                              status: "approved"
                            })}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Отклонить заявку"
                            className="text-destructive hover:bg-destructive/5"
                            onClick={() => updateStatus.mutate({
                              ids: [v.id],
                              status: "rejected"
                            })}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Корректировка заявки</DialogTitle>
            <DialogDescription>
              {editing?.profile?.full_name} · сотрудник получит уведомление об изменениях.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Дата начала</label>
                <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Дата окончания</label>
                <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Статус</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="approved">Подтверждён</SelectItem>
                  <SelectItem value="rejected">Отклонён</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Комментарий</label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={() => adjustRequest.mutate()} disabled={adjustRequest.isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
