import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { NotificationModals } from "@/lib/notify";
import { installGlobalErrorLogging, recordEvent } from "@/lib/log-client";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "../lib/lovable-error-reporting";


function NotFoundComponent() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Decorative blurred blobs */}
      <div className="pointer-events-none absolute -top-1/4 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[8rem]" />
      <div className="pointer-events-none absolute -bottom-1/4 right-1/4 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-[6rem]" />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border bg-card/80 p-10 shadow-2xl backdrop-blur-sm sm:p-14">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Ошибка
          </p>
          <h1 className="mt-2 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-9xl font-bold leading-none tracking-tighter text-transparent">
            404
          </h1>
          <h2 className="mt-4 text-2xl font-semibold text-card-foreground">
            Страница не найдена
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Запрошенный адрес не существует или был перемещён. Проверьте ссылку или вернитесь на главную страницу.
          </p>

          <div className="mt-8">
            <Button asChild size="lg" className="rounded-full px-8 shadow-lg">
              <Link to="/">Вернуться на главную</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    recordEvent({
      level: "error",
      category: "error",
      event: "Сбой страницы",
      message: error.message,
      context: { path: typeof window !== "undefined" ? window.location.pathname : "" },
    });
  }, [error]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -top-1/4 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-destructive/10 blur-[6rem]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm text-center sm:p-12">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Не удалось загрузить страницу
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Что-то пошло не так. Попробуйте обновить страницу или вернитесь на главную.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Попробовать снова
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "График ОКП — сменные графики психологов" },
      {
        name: "description",
        content:
          "Система формирования ежемесячных графиков работы психологов ОКП: смены 2/2, суммированный учёт рабочего времени, отпуска и праздничные дни.",
      },
      { property: "og:title", content: "График ОКП — сменные графики психологов" },
      {
        property: "og:description",
        content:
          "Смены 2/2, учёт часов за период, отпуска, праздники и внутренний чат.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    installGlobalErrorLogging();
  }, []);

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('app-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <NotificationModals />
    </QueryClientProvider>

  );
}
