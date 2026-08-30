import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Plane,
  MessageSquare,
  Users,
  ShieldCheck,
  Settings,
  BarChart3,
  ScrollText,
  UserCircle,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Инструкции по работе — График ОКП" },
      {
        name: "description",
        content:
          "Пошаговые инструкции по работе с графиком смен, отпусками и управлением персоналом с учётом роли пользователя.",
      },
      { property: "og:title", content: "Инструкции по работе — График ОКП" },
      {
        property: "og:description",
        content: "Как работать с календарём смен, отпусками, чатом и администрированием.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

type Section = {
  id: string;
  title: string;
  icon: typeof CalendarDays;
  roles: Array<"employee" | "manager" | "admin">;
  steps: string[];
};

const sections: Section[] = [
  {
    id: "calendar",
    title: "Календарь смен",
    icon: CalendarDays,
    roles: ["employee", "manager", "admin"],
    steps: [
      "Откройте раздел «График» — он открывается первым при входе в систему.",
      "Переключайте режимы просмотра: День, Неделя, Месяц и Год в верхней панели.",
      "В режиме «День» видно время начала смены, перерыв на обед и окончание рабочего дня.",
      "Цвета и обозначения расшифрованы в легенде над сеткой календаря: смена, отпуск, праздник, завершённая смена.",
      "Полоса прогресса на карточке смены показывает, какая часть рабочего времени уже отработана.",
    ],
  },
  {
    id: "my-shifts",
    title: "Моё расписание",
    icon: CalendarDays,
    roles: ["employee"],
    steps: [
      "Если администратор включил самостоятельное формирование смен, в панели появится кнопка «Сформировать моё расписание».",
      "Нажмите на дату в календаре, чтобы добавить или изменить смену на этот день.",
      "Обязательно укажите время обеда — без него смена не сохранится.",
      "При формировании с середины месяца выберите период: весь месяц, до конца месяца или до выбранной даты.",
      "Если кнопки нет — формирование смен доступно только руководителю и администратору.",
    ],
  },
  {
    id: "vacations",
    title: "Отпуск",
    icon: Plane,
    roles: ["employee", "manager", "admin"],
    steps: [
      "Нажмите «Запросить отпуск» в шапке страницы.",
      "Выберите даты начала и окончания, при необходимости добавьте комментарий.",
      "Заявка уходит на подтверждение руководителю или администратору.",
      "Статус заявки и остаток дней отпуска отображаются в разделе «Сводка».",
      "После подтверждения норма рабочего времени пересчитывается автоматически.",
    ],
  },
  {
    id: "profile",
    title: "Профиль и фото",
    icon: UserCircle,
    roles: ["employee", "manager", "admin"],
    steps: [
      "Нажмите на своё имя или аватар внизу бокового меню.",
      "Загрузите фотографию — она отображается в чате и в карточках смен календаря.",
      "Проверьте телефон и должность: эти данные видят руководитель и администратор.",
    ],
  },
  {
    id: "chat",
    title: "Чат",
    icon: MessageSquare,
    roles: ["employee", "manager", "admin"],
    steps: [
      "Чат доступен из круглой кнопки в правом нижнем углу на любой странице.",
      "Выберите собеседника или групповой чат в списке слева.",
      "Можно прикреплять файлы и изображения, добавлять эмодзи и реакции.",
      "Используйте поиск, чтобы найти сообщение по тексту.",
      "О новых сообщениях сообщает значок уведомлений в шапке.",
    ],
  },
  {
    id: "manage-staff",
    title: "Сотрудники",
    icon: Users,
    roles: ["manager", "admin"],
    steps: [
      "Раздел «Управление» → вкладка «Сотрудники».",
      "Кнопка «Добавить сотрудника»: обязательны ФИО, email и пароль (минимум 8 символов).",
      "Выберите группу смены и должность из справочников — их можно изменить и позже в таблице.",
      "Сотрудник, созданный из панели, не требует подтверждения регистрации.",
      "Деактивация учётной записи закрывает вход, не удаляя историю смен и отпусков.",
    ],
  },
  {
    id: "manage-shifts",
    title: "Смены и массовое расписание",
    icon: CalendarDays,
    roles: ["manager", "admin"],
    steps: [
      "Раздел «Управление» → вкладка «Смены».",
      "В фильтрах выберите группу, чтобы увидеть всех сотрудников группы.",
      "Массовая генерация формирует график 2/2 сразу для всей выбранной группы.",
      "Праздничные дни учитываются автоматически и сокращают норму часов.",
    ],
  },
  {
    id: "manage-requests",
    title: "Заявки на отпуск",
    icon: Plane,
    roles: ["manager", "admin"],
    steps: [
      "Раздел «Управление» → вкладка «Заявки на отпуск».",
      "Подтвердите или отклоните заявку; при отклонении укажите причину.",
      "Сотрудник получает уведомление о решении.",
      "Все действия фиксируются в журнале аудита.",
    ],
  },
  {
    id: "stats",
    title: "Отпуска и аналитика",
    icon: BarChart3,
    roles: ["manager", "admin"],
    steps: [
      "Раздел «Управление» → вкладка «Отпуска и аналитика».",
      "Фильтруйте по периоду, группе и сотруднику.",
      "Данные можно выгрузить в Excel для отчётности.",
      "Норма отпуска — 56 дней в год, остаток считается автоматически.",
    ],
  },
  {
    id: "roles",
    title: "Роли и доступы",
    icon: ShieldCheck,
    roles: ["admin"],
    steps: [
      "Раздел «Управление» → вкладка «Роли и доступы».",
      "Назначайте роли: Администратор, Руководитель, Сотрудник.",
      "Подтверждайте новых пользователей, зарегистрировавшихся самостоятельно.",
      "Режим предпросмотра роли в шапке позволяет увидеть систему глазами сотрудника или руководителя.",
    ],
  },
  {
    id: "settings",
    title: "Настройки системы",
    icon: Settings,
    roles: ["manager", "admin"],
    steps: [
      "Праздники РФ: отметьте, какие дни считать нерабочими — норма часов пересчитается.",
      "Нормы по месяцам: задайте плановое рабочее время с учётом смен и праздников.",
      "Система: переключатель «Сотрудник может сам создавать смены».",
      "Справочники: группы смен и должности, которые используются в формах.",
    ],
  },
  {
    id: "logs",
    title: "Журнал событий",
    icon: ScrollText,
    roles: ["admin"],
    steps: [
      "Раздел «Управление» → вкладка «Журнал событий».",
      "Фиксируются входы в систему, ошибки и сбои.",
      "Используйте фильтры по типу события и дате для разбора инцидентов.",
    ],
  },
];

function HelpPage() {
  const [query, setQuery] = useState("");
  const { isAdmin, isManager, profile } = useAuth();
  const role: "employee" | "manager" | "admin" = isAdmin
    ? "admin"
    : isManager
      ? "manager"
      : "employee";

  const roleLabel =
    role === "admin" ? "Администратор" : role === "manager" ? "Руководитель" : "Сотрудник";

  const q = query.trim().toLowerCase();
  const byRole = sections.filter((s) => s.roles.includes(role));
  const visible = q
    ? byRole
        .map((s) => {
          const titleHit = s.title.toLowerCase().includes(q);
          const steps = titleHit ? s.steps : s.steps.filter((t) => t.toLowerCase().includes(q));
          return steps.length ? { ...s, steps } : null;
        })
        .filter((s): s is Section => s !== null)
    : byRole;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
              <BookOpen className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">
                Инструкции для роли: <Badge variant="secondary">{roleLabel}</Badge>
              </CardTitle>
              <CardDescription>
                {role === "employee"
                  ? "Здесь собрано всё, что нужно для работы с графиком, отпусками и чатом."
                  : "Инструкции по работе с графиком, персоналом, заявками и настройками системы."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {role === "employee" && profile?.shift_group ? (
          <CardContent className="text-muted-foreground text-sm">
            Ваша группа смены — {profile.shift_group}. График строится по циклу 2/2.
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <s.icon className="size-4 shrink-0" aria-hidden="true" />
                {s.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
                {s.steps.map((step) => (
                  <li key={step} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Частые вопросы</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>Почему я не вижу кнопку формирования расписания?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                Самостоятельное создание смен включается администратором в настройках системы. Если
                переключатель выключен, смены формируют руководитель и администратор.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Смена не сохраняется — что делать?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                Для рабочей смены обязательно указывать время обеда. Заполните перерыв и повторите
                сохранение.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>Как считается норма рабочего времени?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                Применяется суммированный учёт за полугодие. Норма сокращается на праздничные
                нерабочие дни и на подтверждённые дни отпуска.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>Не удаётся войти после регистрации</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                Самостоятельная регистрация требует подтверждения администратором. Если учётная
                запись деактивирована, вход также будет закрыт — обратитесь к администратору.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
