import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { SystemLogsPage } from "@/components/manage/logs";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { title: "Журнал системы — График ОКП" },
      {
        name: "description",
        content: "Журнал входов, действий и системных ошибок с группировкой одинаковых записей.",
      },
      { property: "og:title", content: "Журнал системы — График ОКП" },
      {
        property: "og:description",
        content: "Входы, действия и ошибки системы в одном журнале для администратора.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogsRoute,
});

function LogsRoute() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center">
          Раздел доступен только администратору системы.
        </CardContent>
      </Card>
    );
  }

  return <SystemLogsPage />;
}
