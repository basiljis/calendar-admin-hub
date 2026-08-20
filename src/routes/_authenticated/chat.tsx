import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Чат отделения — График ОКП" },
      {
        name: "description",
        content: "Внутренний чат психологов ОКП для согласования смен, замен и переносов.",
      },
      { property: "og:title", content: "Чат отделения — График ОКП" },
      { property: "og:description", content: "Общение команды по графику смен в реальном времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["chat"],
    queryFn: async () => {
      const [messages, profiles] = await Promise.all([
        supabase.from("chat_messages").select("*").order("created_at").limit(200),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        messages: messages.data ?? [],
        names: new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])),
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => void qc.invalidateQueries({ queryKey: ["chat"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, content });
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["chat"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Чат отделения</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Замены, переносы смен и рабочие вопросы — в одном месте.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4">
            {(data?.messages ?? []).length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Сообщений пока нет — начните обсуждение.
              </p>
            )}
            {(data?.messages ?? []).map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`group max-w-[80%] rounded-2xl px-3.5 py-2 ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {!mine && (
                      <div className="mb-0.5 text-xs font-medium opacity-80">
                        {data?.names.get(m.user_id) || "Сотрудник"}
                      </div>
                    )}
                    <div className="text-sm break-words whitespace-pre-wrap">{m.content}</div>
                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70">
                      {new Date(m.created_at).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {(mine || isAdmin) && (
                        <button onClick={() => remove(m.id)} aria-label="Удалить сообщение">
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Сообщение коллегам…"
            />
            <Button type="submit" size="icon" aria-label="Отправить">
              <Send className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
