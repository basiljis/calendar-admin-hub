import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresenceInfo = { online: boolean; inChat: boolean };
export type PresenceMap = Record<string, PresenceInfo>;

let channel: ReturnType<typeof supabase.channel> | null = null;
let state: PresenceMap = {};
let selfId: string | null = null;
let selfInChat = false;
const listeners = new Set<(s: PresenceMap) => void>();

function emit() {
  listeners.forEach((l) => l(state));
}

function ensureChannel() {
  if (channel || !selfId) return;
  const ch = supabase.channel("presence-users", {
    config: { presence: { key: selfId } },
  });
  channel = ch;
  ch.on("presence", { event: "sync" }, () => {
    const raw = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
    const next: PresenceMap = {};
    Object.values(raw).forEach((metas) => {
      metas.forEach((m) => {
        const id = m["user_id"] as string | undefined;
        if (!id) return;
        next[id] = {
          online: true,
          inChat: Boolean(next[id]?.inChat) || Boolean(m["in_chat"]),
        };
      });
    });
    state = next;
    emit();
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void ch.track({ user_id: selfId, in_chat: selfInChat });
    }
  });
}

/** Публикует собственное присутствие (в системе / открыт чат). Монтируется один раз. */
export function usePresenceTracker(userId?: string | null, inChat = false) {
  useEffect(() => {
    if (!userId) return;
    selfId = userId;
    ensureChannel();
    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
        state = {};
        emit();
      }
    };
  }, [userId]);

  useEffect(() => {
    selfInChat = inChat;
    if (channel && selfId) void channel.track({ user_id: selfId, in_chat: inChat });
  }, [inChat]);
}

/** Карта присутствия всех подключённых сотрудников. */
export function usePresence(): PresenceMap {
  const [value, setValue] = useState<PresenceMap>(state);
  useEffect(() => {
    const l = (s: PresenceMap) => setValue({ ...s });
    listeners.add(l);
    setValue({ ...state });
    return () => {
      listeners.delete(l);
    };
  }, []);
  return value;
}

/** Открыть личный чат с сотрудником из любого места приложения. */
export function openDirectChat(userId: string) {
  window.dispatchEvent(new CustomEvent("open-direct-chat", { detail: { userId } }));
}
