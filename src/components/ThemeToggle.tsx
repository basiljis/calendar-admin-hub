import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/Hint";
import { TooltipProvider } from "@/components/ui/tooltip";

export type Theme = "light" | "dark";

const STORAGE_KEY = "app-theme";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  };

  return { theme, toggle };
}

/** Переключатель светлой и тёмной темы */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Светлая тема" : "Тёмная тема";

  return (
    <TooltipProvider>
    <Hint label={label} description="Переключение оформления интерфейса" side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={className ?? "h-10 w-10 rounded-full border"}
      >
        {isDark ? (
          <Sun className="size-5 text-muted-foreground" />
        ) : (
          <Moon className="size-5 text-muted-foreground" />
        )}
      </Button>
    </Hint>
    </TooltipProvider>
  );
}
