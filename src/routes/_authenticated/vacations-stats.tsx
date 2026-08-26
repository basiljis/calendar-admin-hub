import { createFileRoute } from "@tanstack/react-router";
import { VacationsStatsPage } from "@/components/manage/vacations-stats";

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
