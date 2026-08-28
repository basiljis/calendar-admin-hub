import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "onboarding-tour-v1";

type Step = {
  selector: string;
  title: string;
  description: string;
};

const DESKTOP_STEPS: Step[] = [
  {
    selector: '[data-tour="sidebar-nav"]',
    title: "Разделы системы",
    description:
      "Здесь основные разделы: главная сводка, график смен, управление сотрудниками и настройки. Доступные пункты зависят от вашей роли.",
  },
  {
    selector: '[data-tour="nav-/calendar"]',
    title: "График смен",
    description:
      "Календарь работы 2/2: смены, обеденные перерывы, праздники и отпуска. Активная смена подсвечивается в реальном времени.",
  },
  {
    selector: '[data-tour="notifications"]',
    title: "Уведомления",
    description:
      "Колокольчик показывает статусы заявок на отпуск и другие важные события. Красный счётчик — количество непрочитанных.",
  },
  {
    selector: '[data-tour="chat-button"]',
    title: "Чат команды",
    description:
      "Общий и личные чаты: файлы, эмодзи, реакции на сообщения и индикатор набора текста.",
  },
  {
    selector: '[data-tour="profile"]',
    title: "Профиль и выход",
    description:
      "Ваши данные, контакты и остаток дней отпуска. Здесь же кнопка выхода из системы.",
  },
];

const MOBILE_STEPS: Step[] = [
  {
    selector: '[data-tour="mobile-nav"]',
    title: "Меню внизу экрана",
    description:
      "Ключевые разделы всегда под рукой: график, сводка и остальные доступные вам страницы.",
  },
  {
    selector: '[data-tour="mobile-menu"]',
    title: "Полное меню",
    description:
      "Кнопка-гамбургер в шапке открывает боковое меню со всеми разделами и помощью.",
  },
  {
    selector: '[data-tour="notifications"]',
    title: "Уведомления",
    description:
      "Колокольчик показывает статусы заявок на отпуск и другие важные события.",
  },
  {
    selector: '[data-tour="chat-button"]',
    title: "Чат команды",
    description:
      "Общий и личные чаты: файлы, эмодзи, реакции и индикатор набора текста.",
  },
  {
    selector: '[data-tour="profile"]',
    title: "Профиль и выход",
    description: "Ваше фото, данные и кнопка выхода из системы.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTour() {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const STEPS = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;


  useEffect(() => {
    if (typeof window === "undefined") return;
    // Автозапуск — только при самом первом входе. Дальше тур доступен по кнопке «Пройти тур».
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        setIsActive(true);
      }, 800);
      return () => clearTimeout(t);
    }
    return;
  }, []);

  useEffect(() => {
    const handler = () => {
      setStepIndex(0);
      setIsActive(true);
    };
    window.addEventListener("start-onboarding-tour", handler);
    return () => window.removeEventListener("start-onboarding-tour", handler);
  }, []);

  const measure = useCallback(() => {
    const step = STEPS[stepIndex];
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [stepIndex]);

  useEffect(() => {
    if (!isActive) return;
    measure();
    const id = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isActive, measure]);

  if (!isActive) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setIsActive(false);
    setStepIndex(0);
  };

  const pad = 8;
  const spotlight = rect
    ? {
        top: Math.max(rect.top - pad, 4),
        left: Math.max(rect.left - pad, 4),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const cardWidth = Math.min(320, window.innerWidth - 32);
  const cardHeight = 240;
  let cardTop = window.innerHeight / 2 - 100;
  let cardLeft = window.innerWidth / 2 - cardWidth / 2;
  if (spotlight) {
    const below = spotlight.top + spotlight.height + 12;
    const above = spotlight.top - cardHeight - 12;
    cardTop =
      below + cardHeight <= window.innerHeight
        ? below
        : above >= 16
          ? above
          : Math.max(window.innerHeight - cardHeight - 16, 16);
    cardLeft = Math.min(
      Math.max(spotlight.left, 16),
      Math.max(window.innerWidth - cardWidth - 16, 16)
    );
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Онбординг-тур">
      {spotlight ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.6)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-foreground/40 dark:bg-background/70" />
      )}

      <div
        className="absolute w-80 rounded-2xl border bg-card p-4 shadow-xl transition-all duration-300"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Шаг {stepIndex + 1} из {STEPS.length}
            </p>
            <h3 className="text-base font-semibold">{step.title}</h3>
          </div>
          <button onClick={finish} aria-label="Закрыть тур" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{step.description}</p>

        <div className="mb-3 flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s.selector}
              className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Пропустить
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStepIndex((i) => i - 1)}>
                Назад
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (stepIndex === STEPS.length - 1 ? finish() : setStepIndex((i) => i + 1))}
            >
              {stepIndex === STEPS.length - 1 ? "Готово" : "Далее"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
