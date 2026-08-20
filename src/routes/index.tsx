import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, ShieldCheck, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { PERIOD, formatHours } from "@/lib/schedule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "График ОКП — сменные графики психологов" },
      {
        name: "description",
        content:
          "Система формирования ежемесячных графиков работы психологов ОКП: смены 2/2, суммированный учёт рабочего времени, отпуска и праздничные дни.",
      },
      { property: "og:title", content: "График ОКП — сменные графики психологов" },
      {
        property: "og:description",
        content: "Смены 2/2, учёт часов за период, отпуска, праздники и внутренний чат.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CalendarDays, title: "Календарь смен", text: "Автогенерация цикла 2/2 по двум группам с ручной правкой любого дня." },
  { icon: ShieldCheck, title: "Учёт часов", text: "Суммированный учёт за период с пересчётом нормы по дням отпуска." },
  { icon: Users, title: "Роли доступа", text: "Администратор, руководитель и сотрудник — каждый видит своё." },
  { icon: MessageSquare, title: "Чат команды", text: "Обсуждение замен и переносов смен прямо в системе." },
];

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-20">
        <span className="bg-secondary text-secondary-foreground inline-flex rounded-full px-3 py-1 text-xs font-medium">
          Пилот: {PERIOD.label} · {formatHours(PERIOD.normHours)} ч
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Ежемесячные графики работы психологов ОКП
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
          Сменная работа двух групп по схеме два через два, суммированный учёт рабочего времени за
          полугодие, подсветка праздничных дней и индивидуальный пересчёт нормы с учётом отпусков.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Войти в систему</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="bg-card rounded-xl border p-5">
              <f.icon className="text-primary size-5" />
              <h2 className="mt-3 font-medium">{f.title}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
