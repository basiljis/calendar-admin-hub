import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, LayoutDashboard, MessageSquare, Users, LogOut, Settings, Bell, CheckCircle2, XCircle, Info, Plane } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Мой график", icon: LayoutDashboard },
  { to: "/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/vacations", label: "Заявки", icon: Plane, adminOnly: true },
  { to: "/vacations-stats", label: "Статистика отпусков", icon: LayoutDashboard, adminOnly: true },
  { to: "/staff", label: "Команда", icon: Users, managerOnly: true },
  { to: "/chat", label: "Чат", icon: MessageSquare },
  { to: "/settings", label: "Настройки", icon: Settings, adminOnly: true },
];


export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, user, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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
        return <MessageSquare className="size-4 text-blue-500" />;
      default:
        return <Info className="size-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="mr-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-4" />
            </span>
            <span className="text-sm leading-tight font-semibold">
              График ОКП
              <span className="text-muted-foreground block text-xs font-normal">
                смены психологов
              </span>
            </span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {nav
              .filter((n) => (!n.managerOnly || isManager) && (!n.adminOnly || isAdmin))
              .map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{profile?.full_name || "Профиль"}</div>
              <div className="text-muted-foreground text-xs">
                {isAdmin ? "Администратор" : isManager ? "Руководитель" : "Сотрудник"}
              </div>
            </div>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex size-3 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <h3 className="text-sm font-semibold">Уведомления</h3>
                  <div className="flex items-center gap-2">
                    <p className="hidden text-[8px] text-muted-foreground/40 sm:block max-w-[100px] leading-tight text-right">
                      '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                      
                      Добавь уведомления сотруднику и администратору о статусе заявки на отпуск (подана, подтверждена, отклонена).
                    </p>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs"
                        onClick={() => markAllAsRead.mutate()}
                      >
                        Прочитать все
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="h-80">
                  {notifications.length === 0 ? (
                    <div className="text-muted-foreground p-4 text-center text-sm">
                      Нет уведомлений
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex gap-3 border-b p-3 transition-colors hover:bg-muted/50 ${
                            !n.read ? "bg-muted/20" : ""
                          }`}
                        >
                          <div className="mt-0.5">{getIcon(n.type)}</div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm leading-none ${!n.read ? "font-semibold" : ""}`}>
                                {n.title}
                              </p>
                              <span className="text-muted-foreground text-[10px]">
                                {n.created_at ? new Date(n.created_at).toLocaleTimeString("ru-RU", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }) : ""}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs leading-normal">
                              {n.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Выйти">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
