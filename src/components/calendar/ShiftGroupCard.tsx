import { MessageCircle } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { UserAvatar } from "@/components/UserAvatar";
import { usePresence, openDirectChat } from "@/hooks/usePresence";

export type GroupMember = {
  id: string;
  full_name: string;
  avatar_url?: string | null | undefined;
  shift_group?: number;
};

interface ShiftGroupCardProps {
  /** Подпись расписания, например «08:00 — 20:00 · обед 13:00» */
  timeLabel: string;
  members: GroupMember[];
  /** Оформление карточки под группу/статус смены */
  tone: string;
  done?: boolean;
  percent?: number;
  currentUserId?: string | undefined;
}

/** Карточка смены: одно расписание — стек аватаров сотрудников со статусами. */
export function ShiftGroupCard({
  timeLabel,
  members,
  tone,
  done = false,
  percent,
  currentUserId,
}: ShiftGroupCardProps) {
  const presence = usePresence();
  const visible = members.slice(0, 3);
  const rest = members.length - visible.length;

  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <div
          className={`relative overflow-hidden rounded-xl px-2 py-1.5 ${tone}`}
          role="group"
          aria-label={`Смена ${timeLabel}, сотрудников: ${members.length}`}
        >
          <div className="truncate text-[11px] font-semibold sm:text-xs">{timeLabel}</div>
          <div className="bg-background/80 mt-1 inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-1 shadow-sm">
            <div className="flex -space-x-2">
              {visible.map((m) => (
                <UserAvatar
                  key={m.id}
                  name={m.full_name}
                  avatarPath={m.avatar_url}
                  className="ring-background size-6 ring-2"
                  fallbackClassName="text-[9px]"
                />
              ))}
            </div>
            {rest > 0 && (
              <span className="text-foreground/80 px-1 text-[11px] font-bold tabular-nums">
                +{rest}
              </span>
            )}
          </div>
          {typeof percent === "number" && !done && (
            <span
              className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-600"
              style={{ width: `${percent}%` }}
              aria-hidden
            />
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64 p-2">
        <p className="text-muted-foreground mb-2 text-[11px] font-medium">
          {timeLabel} · {members.length} чел.
        </p>
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {members.map((m) => {
            const p = presence[m.id];
            const status = p?.inChat ? "В чате" : p?.online ? "В системе" : "Не в сети";
            const dot = p?.inChat ? "bg-sky-500" : p?.online ? "bg-emerald-500" : "bg-muted-foreground/40";
            return (
              <li key={m.id} className="hover:bg-muted/60 flex items-center gap-2 rounded-md p-1">
                <UserAvatar name={m.full_name} avatarPath={m.avatar_url} className="size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{m.full_name}</span>
                  <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    {status}
                  </span>
                </span>
                {m.id !== currentUserId && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Написать в чат"
                    aria-label={`Написать ${m.full_name}`}
                    className="text-primary hover:bg-primary/10 rounded-md p-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      openDirectChat(m.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        openDirectChat(m.id);
                      }
                    }}
                  >
                    <MessageCircle className="size-4" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
