import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  Bell,
  CheckCircle2,
  XCircle,
  Info,
  Plane,
  ChevronLeft,
  ChevronRight,
  User,
  Heart,
  ShieldCheck
} from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ChatWidget } from "@/components/ChatWidget";
import { OnboardingTour } from "@/components/OnboardingTour";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Hint } from "@/components/Hint";
import { ThemeToggle } from "@/components/ThemeToggle";


const nav = [
  { to: "/calendar", label: "График", icon: CalendarDays, hint: "Календарь смен 2/2, обеды и отпуска" },
  { to: "/dashboard", label: "Сводка", icon: LayoutDashboard, hint: "Сводка по сменам, часам и заявкам" },
  { to: "/manage", label: "Управление", icon: Users, managerOnly: true, hint: "Сотрудники, смены, заявки, аналитика и роли" },
  { to: "/settings", label: "Настройки", icon: Settings, adminOnly: true, hint: "Праздники РФ, нормы часов и параметры системы" },
];

const sectionTitles: Record<string, string> = {
  "/dashboard": "Сводка по графику",
  "/calendar": "Календарь смен",
  "/manage": "Управление персоналом",
  "/settings": "Настройки",
  "/vacations": "Заявки на отпуск",
  "/staff": "Сотрудники",
  "/vacations-stats": "Статистика отпусков",
  "/admin": "Администрирование",
};

function getSectionTitle(pathname: string) {
  if (sectionTitles[pathname]) return sectionTitles[pathname];
  if (pathname.startsWith("/admin/users/")) return "Профиль пользователя";
  if (pathname.startsWith("/admin/")) return sectionTitles["/admin"];
  return "График ОКП";
}


export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, user, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sectionTitle = getSectionTitle(pathname);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          toast.info("У вас новое уведомление");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="size-4 text-emerald-500" />;
      case "error":
        return <XCircle className="size-4 text-destructive" />;
      case "warning":
        return <Info className="size-4 text-amber-500" />;
      case "chat":
        return <Info className="size-4 text-blue-500" />;
      default:
        return <Info className="size-4 text-blue-500" />;
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Мобильный оверлей */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}
      {/* Sidebar - Matching reference image style */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar transition-transform duration-300 md:z-30 md:translate-x-0 md:transition-all ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } ${isSidebarCollapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div className="flex h-16 items-center px-6">
          <Link to="/calendar" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-5" />
            </div>
            <span className={`text-xl font-bold tracking-tight text-primary ${isSidebarCollapsed ? "md:hidden" : ""}`}>universum.</span>
          </Link>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav data-tour="sidebar-nav" className="space-y-1">
            {nav
              .filter((n) => (!n.managerOnly || isManager) && (!n.adminOnly || isAdmin))
              .map((n) => (
                <Hint key={n.to} label={n.label} description={n.hint} side="right">
                  <Link
                    to={n.to}
                    data-tour={`nav-${n.to}`}
                    aria-label={n.label}
                    onClick={() => setMobileNavOpen(false)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                  >
                    <n.icon className="size-5 shrink-0" />
                    <span className={isSidebarCollapsed ? "md:hidden" : ""}>{n.label}</span>
                  </Link>
                </Hint>
              ))}
          </nav>
        </ScrollArea>

        {/* Bottom Help/Support Widget from reference image */}
        {isSidebarCollapsed ? (
          <div className="mx-4 mb-6 flex justify-center">
            <Popover>
              <Hint label="Нужна помощь?" description="Мы на связи в рабочее время" side="right">
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    className="size-11 rounded-full bg-blue-50 shadow-sm hover:bg-blue-100 dark:bg-blue-900/10"
                    aria-label="Нужна помощь?"
                  >
                    <Heart className="size-6 text-blue-500" />
                  </Button>
                </PopoverTrigger>
              </Hint>
              <PopoverContent side="right" align="start" className="w-56 p-3">
                <p className="mb-2 text-sm font-semibold">Нужна помощь?</p>
                <Button size="sm" variant="outline" className="w-full bg-card">
                  Связаться с нами
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full text-xs"
                  onClick={() => window.dispatchEvent(new Event("start-onboarding-tour"))}
                >
                  Пройти тур по интерфейсу
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="mx-4 mb-6 rounded-2xl bg-blue-50 p-4 text-center dark:bg-blue-900/10">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-card shadow-sm">
              <Heart className="size-6 text-blue-500" />
            </div>
            <p className="mb-1 text-sm font-semibold">Нужна помощь?</p>
            <p className="mb-3 text-xs text-muted-foreground">Мы на связи в рабочее время</p>
            <Button size="sm" variant="outline" className="w-full bg-card">
              Связаться с нами
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full text-xs"
              onClick={() => window.dispatchEvent(new Event("start-onboarding-tour"))}
            >
              Пройти тур по интерфейсу
            </Button>
          </div>
        )}

        <div className="p-3 border-t">
          <Hint
            label={isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
            description="Больше места для рабочей области"
            side="right"
          >
          <Button
            variant="ghost"
            size="icon"
            aria-label={isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full justify-start gap-3 px-3"
          >
            {isSidebarCollapsed ? <ChevronRight className="size-5" /> : (
              <>
                <ChevronLeft className="size-5" />
                <span>Свернуть меню</span>
              </>
            )}
          </Button>
          </Hint>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarCollapsed ? "pl-20" : "pl-64"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/80 px-8 backdrop-blur">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden">
              <ChevronRight className="size-5" />
            </Button>
            <div className="text-base font-semibold text-foreground">
              {sectionTitle}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button data-tour="notifications" variant="ghost" size="icon" aria-label="Уведомления" title="Уведомления" className="relative h-10 w-10 rounded-full border">
                  <Bell className="size-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-full border-2 border-background bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Уведомления</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs text-primary"
                      onClick={() => markAllAsRead.mutate()}
                    >
                      Прочитать все
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-80">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Нет уведомлений
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex gap-3 border-b p-4 transition-colors hover:bg-muted/50 ${
                            !n.read ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="mt-0.5">{getIcon(n.type)}</div>
                          <div className="flex-1 space-y-1">
                            <p className={`text-sm leading-tight ${!n.read ? "font-semibold" : ""}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-tighter">
                              {n.created_at ? new Date(n.created_at).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }) : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <div data-tour="profile" className="flex items-center gap-3 border-l pl-6">
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground leading-none">
                  {profile?.full_name || "Пользователь"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground leading-none">
                  {profile?.shift_group ? `Группа ${profile.shift_group}` : "Группа не назначена"}
                </div>
              </div>
              <Avatar className="h-10 w-10 border-2 border-primary/10">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <Hint label="Выйти из системы" description="Завершить текущий сеанс" side="bottom">
                <Button variant="ghost" size="icon" aria-label="Выйти из системы" onClick={signOut} className="text-muted-foreground">
                  <LogOut className="size-4" />
                </Button>
              </Hint>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-8">{children}</main>
      </div>
      <ChatWidget />
      <OnboardingTour />
    </div>
    </TooltipProvider>
  );
}
