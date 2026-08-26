import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CalendarDays, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
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
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Проверьте почту — мы отправили ссылку для подтверждения.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Не удалось войти через Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-3 sm:p-5">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-xl lg:grid-cols-2">
        {/* Левая колонка — форма */}
        <div className="flex flex-col px-6 py-10 sm:px-12 sm:py-14">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
              <CalendarDays className="size-5" />
            </span>
            <span className="text-primary text-xl font-bold tracking-tight">График ОКП</span>
          </div>

          <div className="mt-14 sm:mt-20">
            <h1 className="text-primary text-4xl font-bold tracking-tight sm:text-5xl">
              {mode === "in" ? "Здравствуйте!" : "Регистрация"}
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Добро пожаловать в систему графиков психологов ОКП
            </p>
          </div>

          <div className="mt-10">
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl text-sm font-medium"
              onClick={google}
            >
              Войти через Google
              <span className="text-primary ml-1 font-bold">G</span>
            </Button>

            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">или</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={mode === "in" ? signIn : signUp} className="space-y-5">
              {mode === "up" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fio" className="text-xs text-slate-500">
                      ФИО полностью
                    </Label>
                    <Input
                      id="fio"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Иванова Мария Петровна"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs text-slate-500">
                      Телефон
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 900 000-00-00"
                      className="h-12 rounded-xl"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs text-slate-500">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs text-slate-500">
                  Пароль
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "up" ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-full text-sm font-semibold tracking-wide uppercase"
              >
                {mode === "in" ? "Войти" : "Создать аккаунт"}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              {mode === "in" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
              <button
                type="button"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
                className="text-primary font-semibold hover:underline"
              >
                {mode === "in" ? "Зарегистрироваться" : "Войти"}
              </button>
            </p>
            <p className="mt-4 text-center text-xs text-slate-400">
              Первый зарегистрированный пользователь получает права администратора.
            </p>
          </div>
        </div>

        {/* Правая колонка — изображение */}
        <div className="relative hidden min-h-[600px] lg:block">
          <img
            src={officeImg}
            alt="Современный офис ОКП"
            width={1024}
            height={1400}
            className="absolute inset-0 h-full w-full rounded-r-[2rem] object-cover"
          />
          <div className="absolute inset-0 rounded-r-[2rem] bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
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
    </div>
  );
}
