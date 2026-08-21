import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, LayoutDashboard, MessageSquare, Users, LogOut, Settings, Bell, CheckCircle2, XCircle, Info } from "lucide-react";
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
