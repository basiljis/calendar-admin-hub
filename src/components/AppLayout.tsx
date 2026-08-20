import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, LayoutDashboard, MessageSquare, Users, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/dashboard", label: "Мой график", icon: LayoutDashboard },
  { to: "/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/staff", label: "Сотрудники", icon: Users, managerOnly: true },
  { to: "/chat", label: "Чат", icon: MessageSquare },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, isManager, isAdmin } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

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
              .filter((n) => !n.managerOnly || isManager)
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
