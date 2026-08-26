import { createFileRoute } from "@tanstack/react-router";
import { VacationsAdminPage } from "@/components/manage/vacations";

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
