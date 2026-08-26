import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, RefreshCw, Info, CheckCircle2, XCircle, Pencil, Plus, Trash2, Save } from "lucide-react";
import { MONTH_NAMES } from "@/lib/schedule";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Настройки — График ОКП" },
      {
        name: "description",
        content: "Управление системными настройками и праздничными днями.",
      },
    ],
  }),
  component: SettingsPage,
});

type Holiday = {
  holiday_date: string;
  name: string;
  is_working: boolean;
};

type HolidayForm = {
  date: string;
  name: string;
  status: "working" | "off";
};

const EMPTY_FORM: HolidayForm = { date: "", name: "", status: "off" };

function SettingsPage() {
  const { isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ["admin-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      return data as Holiday[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    qc.invalidateQueries({ queryKey: ["holidays"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
    qc.invalidateQueries({ queryKey: ["profiles"] });
  };

  const reimportHolidays = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("holidays")
        .update({ is_working: false })
        .eq("is_working", false);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Данные о праздниках обновлены");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdateHolidays = useMutation({
    mutationFn: async ({ isWorking }: { isWorking: boolean }) => {
      if (!dateFrom || !dateTo) {
        throw new Error("Выберите диапазон дат");
      }
      const { error } = await supabase
        .from("holidays")
        .update({ is_working: isWorking })
        .gte("holiday_date", dateFrom)
        .lte("holiday_date", dateTo);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Статус праздников в выбранном периоде обновлен");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveHoliday = useMutation({
    mutationFn: async () => {
      if (!form.date || !form.name.trim()) {
        throw new Error("Укажите дату и название праздника");
      }
      const payload = {
        holiday_date: form.date,
        name: form.name.trim(),
        is_working: form.status === "working",
      };
      if (editingDate) {
        // Обновление существующего: если дата изменилась — удаляем старую запись и создаём новую
        if (editingDate !== form.date) {
          const { error: delError } = await supabase
            .from("holidays")
            .delete()
            .eq("holiday_date", editingDate);
          if (delError) throw delError;
          const { error: insError } = await supabase.from("holidays").insert(payload);
          if (insError) throw insError;
        } else {
          const { error } = await supabase
            .from("holidays")
            .update({ name: payload.name, is_working: payload.is_working })
            .eq("holiday_date", editingDate);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("holidays").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingDate ? "Праздник обновлён" : "Праздник добавлен");
      setDialogOpen(false);
      setEditingDate(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteHoliday = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from("holidays")
        .delete()
        .eq("holiday_date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Праздник удалён");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAddDialog = () => {
    setEditingDate(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (h: Holiday) => {
    setEditingDate(h.holiday_date);
    setForm({
      date: h.holiday_date,
      name: h.name,
      status: h.is_working ? "working" : "off",
    });
    setDialogOpen(true);
  };

  if (!isManager) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <Info className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Доступ ограничен</h2>
        <p className="text-muted-foreground">У вас нет прав для просмотра этой страницы.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки системы</h1>
        <p className="text-muted-foreground text-sm">
          Управление праздничными днями, нормами часов и параметрами отпусков.
        </p>
      </div>

      <div className="grid gap-6">
        <MonthlyNormsCard canEdit={isManager} />

        {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Массовая настройка праздников</CardTitle>
            <CardDescription>
              Отметьте выбранный диапазон дат как рабочий или нерабочий по конкретному празднику.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">Дата с</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">Дата по</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => bulkUpdateHolidays.mutate({ isWorking: false })}
                  disabled={bulkUpdateHolidays.isPending || !dateFrom || !dateTo}
                  className="gap-2 bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300 disabled:text-rose-50"
                >
                  <XCircle className="size-4" />
                  Сделать нерабочими
                </Button>
                <Button
                  onClick={() => bulkUpdateHolidays.mutate({ isWorking: true })}
                  disabled={bulkUpdateHolidays.isPending || !dateFrom || !dateTo}
                  className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:text-emerald-50"
                >
                  <CheckCircle2 className="size-4" />
                  Сделать рабочими
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Государственные праздники</CardTitle>
              <CardDescription>
                Список праздников, влияющих на расчет нормы рабочих часов
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 gap-2">
                <Button onClick={openAddDialog} size="sm" className="gap-2">
                  <Plus className="size-4" />
                  Добавить праздник
                </Button>
                <Button
                  onClick={() => reimportHolidays.mutate()}
                  disabled={reimportHolidays.isPending}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={`size-4 ${reimportHolidays.isPending ? "animate-spin" : ""}`} />
                  Обновить данные
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Источник</TableHead>
                    {isAdmin && <TableHead className="text-right">Действия</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Загрузка...
                      </TableCell>
                    </TableRow>
                  ) : holidays?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Праздники не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    holidays?.map((h) => (
                      <TableRow key={h.holiday_date}>
                        <TableCell className="font-medium">
                          {new Date(h.holiday_date).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell>{h.name}</TableCell>
                        <TableCell>
                          {h.is_working ? (
                            <Badge variant="outline">Рабочий</Badge>
                          ) : (
                            <Badge className="bg-holiday text-holiday-foreground border-0">Выходной</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          Производственный календарь 2026
                        </TableCell>
                        {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(h)}
                              aria-label={`Редактировать ${h.name}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (window.confirm(`Удалить праздник «${h.name}» (${new Date(h.holiday_date).toLocaleDateString("ru-RU")})?`)) {
                                  deleteHoliday.mutate(h.holiday_date);
                                }
                              }}
                              aria-label={`Удалить ${h.name}`}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDate ? "Редактировать праздник" : "Добавить праздник"}</DialogTitle>
            <DialogDescription>
              Укажите дату, название и статус дня. Статус влияет на расчёт нормы рабочих часов.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="holiday-date">Дата</Label>
              <Input
                id="holiday-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Название</Label>
              <Input
                id="holiday-name"
                placeholder="Например: День народного единства"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-status">Статус дня</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as HolidayForm["status"] }))}
              >
                <SelectTrigger id="holiday-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Выходной</SelectItem>
                  <SelectItem value="working">Рабочий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => saveHoliday.mutate()}
              disabled={saveHoliday.isPending || !form.date || !form.name.trim()}
            >
              {saveHoliday.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type MonthlyNorm = {
  id: string;
  year: number;
  month: number;
  norm_hours: number;
  note: string | null;
};

function MonthlyNormsCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [year, setYear] = useState(2026);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: holidaysData } = useQuery({
    queryKey: ["holidays-year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date, is_working")
        .gte("holiday_date", `${year}-01-01`)
        .lte("holiday_date", `${year}-12-31`);
      if (error) throw error;
      return data;
    },
  });

  const { data: normsData, isLoading } = useQuery({
    queryKey: ["monthly-norms", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_norms")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return data as MonthlyNorm[];
    },
  });

  const stored: Record<number, MonthlyNorm> = {};
  for (const n of normsData ?? []) stored[n.month] = n;

  // Автоподсчёт: рабочие будни минус нерабочие праздники × 8 ч
  const monthStats = MONTH_NAMES.map((label, i) => {
    const month = i + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    let weekdays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) weekdays++;
    }
    const holidaySet = new Map(
      (holidaysData ?? []).map((h) => [h.holiday_date, h.is_working])
    );
    let holidaysOff = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) continue;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (holidaySet.get(iso) === false) holidaysOff++;
    }
    const workdays = weekdays - holidaysOff;
    const suggested = workdays * 8;
    return { month, label, weekdays, holidaysOff, workdays, suggested };
  });

  useEffect(() => {
    setDraft({});
    setNotes({});
  }, [year, normsData]);

  const valueFor = (m: number, suggested: number) =>
    draft[m] ?? (stored[m] ? String(stored[m].norm_hours) : suggested.toFixed(1));
  const noteFor = (m: number) => notes[m] ?? stored[m]?.note ?? "";

  const dirtyMonths = monthStats.filter(
    ({ month, suggested }) =>
      valueFor(month, suggested) !==
        (stored[month] ? String(stored[month].norm_hours) : suggested.toFixed(1)) ||
      noteFor(month) !== (stored[month]?.note ?? "")
  );

  const saveAll = useMutation({
    mutationFn: async () => {
      const rows = monthStats.map(({ month, suggested }) => ({
        year,
        month,
        norm_hours: Number(valueFor(month, suggested).replace(",", ".")) || 0,
        note: noteFor(month) || null,
      }));
      const { error } = await supabase
        .from("monthly_norms")
        .upsert(rows, { onConflict: "year,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Нормы рабочего времени сохранены");
      setDraft({});
      setNotes({});
      qc.invalidateQueries({ queryKey: ["monthly-norms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalNorm = monthStats.reduce(
    (a, { month, suggested }) =>
      a + (Number(valueFor(month, suggested).replace(",", ".")) || 0),
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Норма рабочего времени по месяцам</CardTitle>
          <CardDescription>
            Автоматически рассчитана по производственному календарю с учётом праздников. Изменённые значения сохраняются и используются при пересчёте.
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-28" aria-label="Год">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => saveAll.mutate()}
              disabled={saveAll.isPending || dirtyMonths.length === 0}
            >
              <Save className="size-4" />
              {saveAll.isPending ? "Сохранение..." : dirtyMonths.length > 0 ? `Сохранить (${dirtyMonths.length})` : "Сохранено"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Месяц</TableHead>
                <TableHead className="text-center">Будних дней</TableHead>
                <TableHead className="text-center">Праздников (нераб.)</TableHead>
                <TableHead className="text-center">Рабочих дней</TableHead>
                <TableHead className="text-center">Расчётная норма</TableHead>
                <TableHead className="w-[130px]">Норма, ч</TableHead>
                <TableHead>Комментарий</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : (
                monthStats.map(({ month, label, weekdays, holidaysOff, workdays, suggested }) => {
                  const isDirty = dirtyMonths.some((d) => d.month === month);
                  return (
                    <TableRow key={month} className={isDirty ? "bg-amber-50" : undefined}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="text-center">{weekdays}</TableCell>
                      <TableCell className="text-center">
                        {holidaysOff > 0 ? (
                          <Badge className="bg-holiday text-holiday-foreground border-0">{holidaysOff}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">{workdays}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {suggested.toFixed(1).replace(".", ",")} ч
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={valueFor(month, suggested)}
                          disabled={!canEdit}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [month]: e.target.value }))
                          }
                          className="h-8 w-24"
                          aria-label={`Норма часов: ${label}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="—"
                          value={noteFor(month)}
                          disabled={!canEdit}
                          onChange={(e) =>
                            setNotes((n) => ({ ...n, [month]: e.target.value }))
                          }
                          className="h-8"
                          aria-label={`Комментарий: ${label}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {!isLoading && (
                <TableRow className="bg-secondary/40 font-semibold">
                  <TableCell>Итого за год</TableCell>
                  <TableCell className="text-center">
                    {monthStats.reduce((a, m) => a + m.weekdays, 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {monthStats.reduce((a, m) => a + m.holidaysOff, 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {monthStats.reduce((a, m) => a + m.workdays, 0)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {monthStats.reduce((a, m) => a + m.suggested, 0).toFixed(1).replace(".", ",")} ч
                  </TableCell>
                  <TableCell colSpan={2}>{totalNorm.toFixed(1).replace(".", ",")} ч</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Расчётная норма = рабочие будни минус нерабочие праздники, по 8 часов. Отредактируйте значение в колонке «Норма, ч» при необходимости и нажмите «Сохранить».
        </p>
      </CardContent>
    </Card>
  );
}
