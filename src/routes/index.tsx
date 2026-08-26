import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

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
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/auth", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <span className="text-sm text-slate-400">Загрузка…</span>
    </div>
  );
}
