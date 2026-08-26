import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plane, Users, Calendar, AlertCircle, Filter, RotateCcw } from "lucide-react";
import { VACATION_DAYS_BASE } from "@/lib/schedule";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpHint } from "@/components/Hint";

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MONTHS_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const YEARS = [2024, 2025, 2026, 2027, 2028];

const toDate = (s: string) => new Date(`${s}T00:00:00`);
const daysBetween = (a: Date, b: Date) =>
  Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;

export function VacationsStatsPage() {
  const { isAdmin } = useAuth();

  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = useState<string>("all");
  const [group, setGroup] = useState<string>("all");
  const [employee, setEmployee] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const resetFilters = () => {
    setYear(String(new Date().getFullYear()));
    setMonth("all");
    setGroup("all");
    setEmployee("all");
    setDateFrom("");
    setDateTo("");
  };

  const { data: raw, isLoading } = useQuery({
    queryKey: ["vacation-stats-raw"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, shift_group");
      const { data: vacations } = await supabase
        .from("vacations")
        .select("*")
        .eq("status", "approved");
      return { profiles: profiles || [], vacations: vacations || [] };
    },
    enabled: isAdmin,
  });

  const stats = useMemo(() => {
    if (!raw) return null;

    // Границы периода: произвольная дата имеет приоритет над годом/месяцем
    let periodStart: Date;
    let periodEnd: Date;
    const custom = Boolean(dateFrom || dateTo);
    if (custom) {
      periodStart = dateFrom ? toDate(dateFrom) : new Date(1970, 0, 1);
      periodEnd = dateTo ? toDate(dateTo) : new Date(2100, 11, 31);
    } else {
      const y = Number(year);
      if (month === "all") {
        periodStart = new Date(y, 0, 1);
        periodEnd = new Date(y, 11, 31);
      } else {
        const m = Number(month);
        periodStart = new Date(y, m, 1);
        periodEnd = new Date(y, m + 1, 0);
      }
    }

    const profiles = raw.profiles.filter(
      (p) =>
        (group === "all" || String(p.shift_group) === group) &&
        (employee === "all" || p.id === employee),
    );
    const allowed = new Set(profiles.map((p) => p.id));

    const employeeUsage: Record<string, number> = {};
    const monthlyLoad: Record<number, Set<string>> = {};
    let periods = 0;

    raw.vacations.forEach((v) => {
      if (!allowed.has(v.user_id)) return;
      const start = toDate(v.start_date);
      const end = toDate(v.end_date);
      const from = start > periodStart ? start : periodStart;
      const to = end < periodEnd ? end : periodEnd;
      if (from > to) return;

      periods += 1;
      employeeUsage[v.user_id] = (employeeUsage[v.user_id] || 0) + daysBetween(from, to);

      const cur = new Date(from);
      while (cur <= to) {
        const m = cur.getMonth();
        if (!monthlyLoad[m]) monthlyLoad[m] = new Set();
        monthlyLoad[m].add(v.user_id);
        cur.setDate(cur.getDate() + 1);
      }
    });

    const employeeData = profiles
      .map((p) => ({ name: p.full_name || "Без имени", days: employeeUsage[p.id] || 0 }))
      .sort((a, b) => b.days - a.days);

    const loadData = MONTHS.map((name, index) => ({
      name,
      count: monthlyLoad[index]?.size || 0,
    })).filter((_, index) => custom || month === "all" || index === Number(month));

    return {
      employeeData,
      loadData,
      totalVacations: periods,
      totalProfiles: profiles.length,
      periodLabel: custom
        ? `${dateFrom || "…"} — ${dateTo || "…"}`
        : month === "all"
          ? year
          : `${MONTHS_FULL[Number(month)]} ${year}`,
    };
  }, [raw, year, month, group, employee, dateFrom, dateTo]);

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <AlertCircle className="mx-auto size-12 text-destructive mb-2" />
            <CardTitle>Доступ ограничен</CardTitle>
            <CardDescription>Статистика доступна только администраторам.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Аналитика отпусков</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Использование отпусков по сотрудникам и загрузка команды по месяцам.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-muted-foreground" />
            Фильтры
            <HelpHint text="Произвольный диапазон дат имеет приоритет над выбором года и месяца." />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label>Год</Label>
            <Select value={year} onValueChange={setYear} disabled={Boolean(dateFrom || dateTo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Месяц</Label>
            <Select value={month} onValueChange={setMonth} disabled={Boolean(dateFrom || dateTo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все месяцы</SelectItem>
                {MONTHS_FULL.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-from">Дата с</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-to">Дата по</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Группа</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                <SelectItem value="1">Группа 1</SelectItem>
                <SelectItem value="2">Группа 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Сотрудник</Label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger><SelectValue placeholder="Все сотрудники" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {(raw?.profiles || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "Без имени"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 xl:col-span-6">
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-2">
              <RotateCcw className="size-4" />
              Сбросить фильтры
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Всего отпусков</CardTitle>
            <Plane className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalVacations || 0}</div>
            <p className="text-xs text-muted-foreground">подтвержденных периодов</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Сотрудников</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProfiles || 0}</div>
            <p className="text-xs text-muted-foreground">в системе</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Период отчета</CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.periodLabel || "—"}</div>
            <p className="text-xs text-muted-foreground">с учетом фильтров</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Использовано дней по сотрудникам</CardTitle>
            <CardDescription>Суммарное количество подтвержденных дней отпуска</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">Загрузка...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.employeeData || []} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="days" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Загрузка команды по месяцам</CardTitle>
            <CardDescription>Количество сотрудников в отпуске одновременно</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">Загрузка...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.loadData || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Детальный список использования</CardTitle>
          <CardDescription>Рейтинг сотрудников по количеству отгулянных дней</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-right">Использовано дней</TableHead>
                <TableHead className="text-right">Остаток (из {VACATION_DAYS_BASE})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.employeeData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.days}</TableCell>
                  <TableCell className="text-right">{Math.max(0, VACATION_DAYS_BASE - row.days)}</TableCell>
                </TableRow>
              ))}
              {stats?.employeeData.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Данные отсутствуют
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}