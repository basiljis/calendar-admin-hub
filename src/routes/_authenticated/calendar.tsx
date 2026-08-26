import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/manage/calendar";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Календарь смен — График ОКП" },
      {
        name: "description",
        content:
          "Месячный календарь смен 2/2 по двум группам психологов, отпуска и праздничные дни.",
      },
      { property: "og:title", content: "Календарь смен — График ОКП" },
      { property: "og:description", content: "Автогенерация графика 2/2 и ручная правка смен." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});
