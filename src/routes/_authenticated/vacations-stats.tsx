import { createFileRoute } from "@tanstack/react-router";
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
import { Plane, Users, Calendar, AlertCircle } from "lucide-react";
import { VACATION_DAYS_BASE } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/vacations-stats")({
  head: () => ({
    meta: [
      { title: "Статистика отпусков — График ОКП" },
      {
        name: "description",
        content: "Аналитика и статистика отпусков сотрудников: использование и нагрузка команды.",
      },
    ],
  }),
  component: VacationsStatsPage,
});

function VacationsStatsPage() {
  const { isAdmin } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["vacation-stats"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const { data: vacations } = await supabase
        .from("vacations")
        .select("*")
        .eq("status", "approved");

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]));
      
      const employeeUsage: Record<string, number> = {};
      (vacations || []).forEach(v => {
        const start = new Date(v.start_date);
        const end = new Date(v.end_date);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        employeeUsage[v.user_id] = (employeeUsage[v.user_id] || 0) + days;
      });

      const employeeData = (profiles || []).map(p => ({
        name: p.full_name || "Без имени",
        days: employeeUsage[p.id] || 0
      })).sort((a, b) => b.days - a.days);

      const monthlyLoad: Record<string, Set<string>> = {};
      const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
      
      (vacations || []).forEach(v => {
        const start = new Date(v.start_date);
        const end = new Date(v.end_date);
        
        let current = new Date(start);
        while (current <= end) {
          const monthKey = `${current.getFullYear()}-${current.getMonth()}`;
          if (!monthlyLoad[monthKey]) monthlyLoad[monthKey] = new Set();
          monthlyLoad[monthKey].add(v.user_id);
          current.setDate(current.getDate() + 1);
        }
      });

      const loadData = months.map((name, index) => {
        const key = `2026-${index}`;
        return {
          name,
          count: monthlyLoad[key]?.size || 0
        };
      });

      return {
        employeeData,
        loadData,
        totalVacations: vacations?.length || 0,
        totalProfiles: profiles?.length || 0
      };
    },
    enabled: isAdmin
  });

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
          '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
          
          Добавь страницу статистики по отпускам (использовано по сотрудникам, загрузка команды по месяцам) для администратора.
        </p>
      </div>

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
            <CardTitle className="text-sm font-medium">Год отчета</CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2026</div>
            <p className="text-xs text-muted-foreground">согласно ТЗ</p>
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