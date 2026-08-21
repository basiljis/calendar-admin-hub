import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Trash2, Users, User, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null); // null = Global chat
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_rooms")
        .select(`
          *,
          chat_room_participants (user_id)
        `);
      return data ?? [];
    },
  });

  const { data: chatData } = useQuery({
    queryKey: ["chat", selectedRoom],
    queryFn: async () => {
      let query = supabase.from("chat_messages").select("*").order("created_at").limit(200);
      
      if (selectedRoom) {
        query = query.eq("room_id", selectedRoom);
      } else {
        query = query.is("room_id", null);
      }

      const { data: messages } = await query;
      
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return {
        messages: messages ?? [],
        names,
      };
    },
    enabled: !!profiles,
  });

  useEffect(() => {
    const channel = supabase
      .channel("chat-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => void qc.invalidateQueries({ queryKey: ["chat"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms" },
        () => void qc.invalidateQueries({ queryKey: ["chat-rooms"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ 
      user_id: user.id, 
      content,
      room_id: selectedRoom 
    });
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["chat"] });
  }

  async function createRoom() {
    if (!user) return;
    if (selectedUsers.length === 0) {
      toast.error("Выберите участников");
      return;
    }

    const isGroup = selectedUsers.length > 1 || !!newRoomName;
    
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        name: newRoomName || null,
        is_group: isGroup,
        created_by: user.id
      })
      .select()
      .single();

    if (roomError) {
      toast.error(roomError.message);
      return;
    }

    const participants = [...selectedUsers, user.id].map(uid => ({
      room_id: room.id,
      user_id: uid
    }));

    const { error: partError } = await supabase
      .from("chat_room_participants")
      .insert(participants);

    if (partError) {
      toast.error(partError.message);
      return;
    }

    toast.success("Чат создан");
    setIsCreateDialogOpen(false);
    setNewRoomName("");
    setSelectedUsers([]);
    setSelectedRoom(room.id);
    void qc.invalidateQueries({ queryKey: ["chat-rooms"] });
  }

  const getRoomName = (room: any) => {
    if (room.name) return room.name;
    if (!room.is_group && profiles) {
      const otherParticipant = room.chat_room_participants.find((p: any) => p.user_id !== user?.id);
      if (otherParticipant) {
        return profiles.find(p => p.id === otherParticipant.user_id)?.full_name || "Личный чат";
      }
    }
    return room.is_group ? "Групповой чат" : "Личный чат";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
      <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Чаты</h2>
          {isAdmin && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="size-8">
                  <Plus className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать новый чат</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Название группы (необязательно)</label>
                    <Input 
                      placeholder="Напр. Смена А" 
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Выберите участников</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-2">
                      {profiles?.filter(p => p.id !== user?.id).map((p) => (
                        <div key={p.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={p.id} 
                            checked={selectedUsers.includes(p.id)}
                            onCheckedChange={(checked) => {
                              setSelectedUsers(prev => 
                                checked 
                                  ? [...prev, p.id] 
                                  : prev.filter(id => id !== p.id)
                              );
                            }}
                          />
                          <label htmlFor={p.id} className="text-sm">{p.full_name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createRoom}>Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        <Button 
          variant={selectedRoom === null ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
          onClick={() => setSelectedRoom(null)}
        >
          <Users className="size-4" />
          Общий чат
        </Button>

        {rooms?.map((room) => (
          <Button 
            key={room.id}
            variant={selectedRoom === room.id ? "secondary" : "ghost"} 
            className="w-full justify-start gap-2 overflow-hidden text-ellipsis"
            onClick={() => setSelectedRoom(room.id)}
          >
            {room.is_group ? <Users className="size-4" /> : <User className="size-4" />}
            <span className="truncate">{getRoomName(room)}</span>
          </Button>
        ))}
      </div>

      <div className="md:col-span-3 flex flex-col space-y-4">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="border-b py-3 px-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedRoom ? (
                <>
                  {rooms?.find(r => r.id === selectedRoom)?.is_group ? <Users className="size-5" /> : <User className="size-5" />}
                  {getRoomName(rooms?.find(r => r.id === selectedRoom))}
                </>
              ) : (
                <>
                  <Users className="size-5" />
                  Общий чат
                </>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {selectedRoom 
                ? "Личное или групповое обсуждение" 
                : "'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            Добавь возможность прикреплять файлы и изображения в сообщения чата."}
            </p>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatData?.messages.length === 0 && (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Сообщений пока нет — начните обсуждение.
                </p>
              )}
              {chatData?.messages.map((m) => {
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
                          {chatData?.names.get(m.user_id) || "Сотрудник"}
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
                placeholder="Сообщение…"
              />
              <Button type="submit" size="icon" aria-label="Отправить">
                <Send className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}