import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Users, Plane, CalendarDays, BarChart3, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { StaffPage } from "@/components/manage/staff";
import { VacationsAdminPage } from "@/components/manage/vacations";
import { CalendarPage } from "@/components/manage/calendar";
import { VacationsStatsPage } from "@/components/manage/vacations-stats";
import { AdminPage } from "@/components/manage/admin";

const searchSchema = z.object({
  tab: fallback(
    z.enum(["staff", "requests", "shifts", "stats", "users"]),
    "staff"
  ).default("staff"),
});

export const Route = createFileRoute("/_authenticated/manage")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Управление персоналом — График ОКП" },
      {
        name: "description",
        content:
          "Единая панель управления: сотрудники, смены, заявки на отпуск, статистика и роли доступа.",
      },
      { property: "og:title", content: "Управление персоналом — График ОКП" },
      {
        property: "og:description",
        content: "Отпуска, смены и заявки сотрудников в одном рабочем пространстве.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { tab = "staff" } = Route.useSearch();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();

  if (!isAdmin && !isManager) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Раздел доступен только администраторам и руководителям.
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    { value: "staff", label: "Сотрудники", icon: Users, show: true },
    { value: "shifts", label: "Смены", icon: CalendarDays, show: true },
    { value: "requests", label: "Заявки на отпуск", icon: Plane, show: true },
    { value: "stats", label: "Отпуска и аналитика", icon: BarChart3, show: true },
    { value: "users", label: "Роли и доступы", icon: ShieldCheck, show: isAdmin },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ to: "/manage", search: (prev) => ({ ...prev, tab: value as typeof tab }) })
        }
        className="space-y-6"
      >
        <TabsList aria-label="Разделы управления персоналом">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="staff" className="mt-0">
          <StaffPage />
        </TabsContent>
        <TabsContent value="shifts" className="mt-0">
          <CalendarPage />
        </TabsContent>
        <TabsContent value="requests" className="mt-0">
          <VacationsAdminPage />
        </TabsContent>
        <TabsContent value="stats" className="mt-0">
          <VacationsStatsPage />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="users" className="mt-0">
            <AdminPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
