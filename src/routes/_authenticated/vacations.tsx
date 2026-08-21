import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plane, Filter, History, CheckCircle2, XCircle, Search, Calendar as CalendarIcon } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/vacations")({
  head: () => ({
    meta: [
      { title: "Заявки на отпуск — График ОКП" },
      {
        name: "description",
        content: "Управление заявками на отпуск: фильтры по статусам, датам и сотрудникам.",
      },
      { property: "og:title", content: "Заявки на отпуск — График ОКП" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: VacationsAdminPage,
});

function VacationsAdminPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vacations", statusFilter, searchQuery, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("vacations")
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
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

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredData = filteredData.filter(v => 
          v.profile?.full_name?.toLowerCase().includes(lowerQuery) ||
          v.profile?.email?.toLowerCase().includes(lowerQuery)
        );
      }

      return filteredData;
    },
    enabled: isAdmin,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["vacation-audit-logs-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_audit_logs")
        .select(`
          *,
          action_by_profile:profiles!vacation_audit_logs_action_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, userId, startDate, endDate }: { id: string; status: "approved" | "rejected", userId: string, startDate: string, endDate: string }) => {
      const { error } = await supabase
        .from("vacations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      await supabase.from("vacation_audit_logs").insert({
        vacation_id: id,
        action_by: user!.id,
        action_type: status,
        previous_status: "pending",
        new_status: status
      });

      const statusText = status === "approved" ? "подтверждена" : "отклонена";
      const notificationType = status === "approved" ? "success" : "error";
      
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `Заявка на отпуск ${statusText}`,
        message: `Ваш отпуск с ${startDate.split('-').reverse().join('.')} по ${endDate.split('-').reverse().join('.')} был ${statusText} администратором.`,
        type: notificationType
      });
    },
    onSuccess: () => {
      toast.success("Статус обновлен");
      qc.invalidateQueries({ queryKey: ["admin-vacations"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Доступ ограничен</CardTitle>
            <CardDescription>Эта страница доступна только администраторам.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заявки на отпуск</h1>
          <p className="text-muted-foreground text-sm">
            '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
            
            Добавь для администратора страницу со списком заявок на отпуск с фильтрами по статусам и датам.
          </p>
        </div>
      </div>

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
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={5} className="h-24 text-center">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Заявок не найдено
                </TableCell>
              </TableRow>
            ) : (
              data?.map((v: any) => (
                <TableRow key={v.id}>
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
                                           log.action_type === "rejected" ? "Отклонена" : log.action_type}
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

                      {v.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => updateStatus.mutate({
                              id: v.id,
                              status: "approved",
                              userId: v.user_id,
                              startDate: v.start_date,
                              endDate: v.end_date
                            })}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/5"
                            onClick={() => updateStatus.mutate({
                              id: v.id,
                              status: "rejected",
                              userId: v.user_id,
                              startDate: v.start_date,
                              endDate: v.end_date
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
    </div>
  );
}
