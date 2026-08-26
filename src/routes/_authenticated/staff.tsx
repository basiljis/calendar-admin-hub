import { createFileRoute } from "@tanstack/react-router";
import { StaffPage } from "@/components/manage/staff";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Сотрудники — График ОКП" },
      {
        name: "description",
        content: "Карточки психологов ОКП: контакты, группа смен, роли доступа и отпуска.",
      },
      { property: "og:title", content: "Сотрудники — График ОКП" },
      { property: "og:description", content: "Управление составом смен, ролями и отпусками." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StaffPage,
});
