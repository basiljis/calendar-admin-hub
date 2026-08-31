import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RELEASES, APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/_authenticated/changelog")({
  head: () => ({
    meta: [
      { title: "Что нового — График ОКП" },
      {
        name: "description",
        content:
          "История обновлений системы графика смен: новые возможности чата, календаря и мобильной версии.",
      },
      { property: "og:title", content: "Что нового — График ОКП" },
      { property: "og:description", content: "Список изменений по версиям системы." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="truncate text-base">Что нового</CardTitle>
                <CardDescription>История обновлений системы</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              Версия {APP_VERSION}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {RELEASES.map((r, i) => (
        <Card key={r.version}>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Версия {r.version}
              {i === 0 && <Badge className="text-[10px]">актуальная</Badge>}
              <span className="text-muted-foreground text-xs font-normal">{r.date}</span>
            </CardTitle>
            <CardDescription>{r.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
              {r.items.map((it) => (
                <li key={it} className="leading-relaxed">
                  {it}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
