import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/manage/admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Администрирование — График ОКП" },
      {
        name: "description",
        content:
          "Панель администратора: управление пользователями, ролями доступа и данными профилей психологов ОКП.",
      },
      { property: "og:title", content: "Администрирование — График ОКП" },
      {
        property: "og:description",
        content: "Управление пользователями и ролями доступа в системе графиков ОКП.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});
