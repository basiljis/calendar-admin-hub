import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, CalendarDays, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import officeImg from "@/assets/auth-office.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — График ОКП" },
      {
        name: "description",
        content: "Вход и регистрация в системе сменных графиков психологов ОКП.",
      },
      { property: "og:title", content: "Вход — График ОКП" },
      { property: "og:description", content: "Доступ к календарю смен, учёту часов и чату." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("disabled=1")) {
      setAuthError("Учётная запись отключена. Обратитесь к администратору.");
    }
    if (typeof window !== "undefined" && window.location.search.includes("pending=1")) {
      setAuthError(
        "Регистрация отправлена на подтверждение. Доступ откроется после проверки администратором или руководителем.",
      );
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const msg = /banned|disabled/i.test(error.message)
        ? "Учётная запись отключена. Обратитесь к администратору."
        : error.message;
      setAuthError(msg);
      toast.error(msg);
      emailRef.current?.focus();
      return;
    }
    setAuthSuccess("Вход выполнен. Переходим в систему…");
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });
    setBusy(false);
    if (error) {
      setAuthError(error.message);
      toast.error(error.message);
      return;
    }
    const successMessage = data.session
      ? "Регистрация завершена. Переходим в систему…"
      : "Проверьте почту — мы отправили ссылку для подтверждения.";
    setAuthSuccess(successMessage);
    toast.success(successMessage);
    if (!data.session) return;
    navigate({ to: "/dashboard", replace: true });
  }

  const errorId = authError ? "auth-error" : undefined;

  return (
    <div className="grid h-screen w-screen overflow-hidden bg-background lg:grid-cols-2">
      {/* Левая колонка — форма */}
      <div className="flex h-full flex-col overflow-y-auto px-8 py-10 sm:px-14 sm:py-14">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <CalendarDays className="size-5" />
          </span>
          <span className="text-primary text-xl font-bold tracking-tight">График ОКП</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-14 sm:mt-20">
          <h1 className="text-primary text-4xl font-bold tracking-tight sm:text-5xl">
            {mode === "in" ? "Здравствуйте!" : "Регистрация"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Добро пожаловать в систему графиков психологов ОКП
          </p>
        </div>

        <div className="mt-10">
          {authError && (
            <div
              id="auth-error"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {authError}
            </div>
          )}
          {authSuccess && (
            <div
              id="auth-success"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {authSuccess}
            </div>
          )}

          <form onSubmit={mode === "in" ? signIn : signUp} className="space-y-5">
            {mode === "up" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fio" className="text-xs text-muted-foreground">
                    ФИО полностью
                  </Label>
                  <Input
                    id="fio"
                    name="fio"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванова Мария Петровна"
                    className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    aria-invalid={authError ? "true" : undefined}
                    aria-describedby={errorId}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs text-muted-foreground">
                    Телефон
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 900 000-00-00"
                    className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    aria-invalid={authError ? "true" : undefined}
                    aria-describedby={errorId}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </Label>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                required
                autoComplete={mode === "in" ? "email" : "username email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                aria-invalid={authError ? "true" : undefined}
                aria-describedby={errorId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs text-muted-foreground">
                Пароль
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={mode === "up" ? 6 : undefined}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                aria-invalid={authError ? "true" : undefined}
                aria-describedby={errorId}
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-full text-sm font-semibold tracking-wide uppercase focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {mode === "in" ? "Войти" : "Создать аккаунт"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "in" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setAuthSuccess(null);
                setMode(mode === "in" ? "up" : "in");
              }}
              className="text-primary font-semibold hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {mode === "in" ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </div>
      </div>

      {/* Правая колонка — изображение */}
      <div className="relative hidden h-full lg:block">
        <img
          src={officeImg}
          alt="Современный офис ОКП"
          width={1024}
          height={1400}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute right-10 bottom-10 left-10 text-white">
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-semibold">Работать стало проще</p>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            График смен, отпуска и учёт часов — всё в одном месте. Больше никаких таблиц в
            блокнотах и потерянных заявок.
          </p>
          <p className="mt-4 text-xs font-medium text-white/70">
            Команда психологов ОКП
          </p>
        </div>
      </div>
    </div>
  );
}
