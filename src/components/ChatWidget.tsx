import { useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  Send,
  Trash2,
  Users,
  User,
  Plus,
  Paperclip,
  X,
  FileIcon,
  Image as ImageIcon,
  Search,
  Calendar,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/EmojiPicker";

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
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatWidget() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ file: File; id: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const insertEmoji = (emoji: string) => {
    const el = messageInputRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };


  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUserId, setSearchUserId] = useState<string>("all");
  const [searchDate, setSearchDate] = useState<Date | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

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
        .select(`*, chat_room_participants (user_id)`);
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
      return { messages: messages ?? [], names };
    },
    enabled: !!profiles,
  });

  const messageIds = (chatData?.messages ?? []).map((m: any) => m.id);

  const { data: reactions } = useQuery({
    queryKey: ["chat-reactions", selectedRoom, messageIds.length, messageIds[messageIds.length - 1]],
    queryFn: async () => {
      if (messageIds.length === 0) return [] as any[];
      const { data } = await supabase
        .from("chat_message_reactions")
        .select("*")
        .in("message_id", messageIds);
      return data ?? [];
    },
    enabled: messageIds.length > 0,
  });

  const reactionsByMessage = new Map<string, { emoji: string; count: number; mine: boolean }[]>();
  for (const r of (reactions ?? []) as any[]) {
    const list = reactionsByMessage.get(r.message_id) ?? [];
    const found = list.find((x) => x.emoji === r.emoji);
    if (found) {
      found.count += 1;
      if (r.user_id === user?.id) found.mine = true;
    } else {
      list.push({ emoji: r.emoji, count: 1, mine: r.user_id === user?.id });
    }
    reactionsByMessage.set(r.message_id, list);
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = ((reactions ?? []) as any[]).find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
    );
    if (existing) {
      const { error } = await supabase.from("chat_message_reactions").delete().eq("id", existing.id);
      if (error) toast.error("Не удалось убрать реакцию");
    } else {
      const { error } = await supabase
        .from("chat_message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
      if (error) toast.error("Не удалось поставить реакцию");
    }
    void qc.invalidateQueries({ queryKey: ["chat-reactions"] });
  };


  const { data: readStatuses } = useQuery({
    queryKey: ["chat-read-status", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("chat_read_status").select("*").eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["chat-unread", user?.id],
    queryFn: async () => {
      if (!user || !readStatuses) return 0;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("room_id, created_at, user_id")
        .neq("user_id", user.id)
        .gte("created_at", thirtyDaysAgo);
      if (!messages) return 0;
      const readMap = new Map(
        readStatuses.map((s: any) => [s.room_id ?? "null", new Date(s.last_read_at)])
      );
      return messages.filter((m) => {
        const lastRead = readMap.get(m.room_id ?? "null");
        if (!lastRead) return true;
        return new Date(m.created_at) > lastRead;
      }).length;
    },
    enabled: !!user && !!readStatuses,
  });

  useEffect(() => {
    const channel = supabase
      .channel("chat-widget-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => {
          void qc.invalidateQueries({ queryKey: ["chat"] });
          void qc.invalidateQueries({ queryKey: ["chat-unread", user?.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms" },
        () => void qc.invalidateQueries({ queryKey: ["chat-rooms"] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);

  useEffect(() => {
    if (isOpen) {
      bottom.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatData?.messages.length, isOpen]);

  const markAsRead = async (roomId: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("chat_read_status")
      .upsert(
        { user_id: user.id, room_id: roomId ? roomId : null, last_read_at: new Date().toISOString() } as any,
        { onConflict: "user_id, room_id" }
      );
    if (!error) {
      qc.invalidateQueries({ queryKey: ["chat-read-status", user.id] });
    }
  };

  useEffect(() => {
    if (isOpen) {
      markAsRead(selectedRoom);
    }
  }, [selectedRoom, chatData?.messages.length, isOpen, user?.id]);

  const getUnreadCount = (roomId: string | null) => {
    if (!readStatuses || !user || !chatData?.messages) return 0;
    const status = (readStatuses as any[]).find((s) => s.room_id === roomId);
    if (!status) return 0;
    return chatData.messages.filter(
      (m) => m.user_id !== user.id && new Date(m.created_at) > new Date(status.last_read_at)
    ).length;
  };

  const handleSearch = async () => {
    if (!searchQuery && searchUserId === "all" && !searchDate) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    let query = supabase.from("chat_messages").select("*").order("created_at", { ascending: false });
    if (selectedRoom) {
      query = query.eq("room_id", selectedRoom);
    } else {
      query = query.is("room_id", null);
    }
    if (searchQuery) query = query.ilike("content", `%${searchQuery}%`);
    if (searchUserId !== "all") query = query.eq("user_id", searchUserId);
    if (searchDate) {
      const startOfDay = new Date(searchDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(searchDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte("created_at", startOfDay.toISOString()).lte("created_at", endOfDay.toISOString());
    }
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setSearchResults(data || []);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchUserId("all");
    setSearchDate(undefined);
    setIsSearching(false);
    setIsSearchOpen(false);
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if ((!content && attachments.length === 0) || !user) return;
    setIsUploading(true);
    const uploadedAttachments = [];
    try {
      for (const { file } of attachments) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(filePath, file);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);
        uploadedAttachments.push({ name: file.name, url: publicUrl, type: file.type, size: file.size });
      }
      const { error } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        content,
        room_id: selectedRoom,
        attachments: uploadedAttachments,
      });
      if (error) throw error;
      setText("");
      setAttachments([]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

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
      .insert({ name: newRoomName || null, is_group: isGroup, created_by: user.id })
      .select()
      .single();
    if (roomError) {
      toast.error(roomError.message);
      return;
    }
    const participants = [...selectedUsers, user.id].map((uid) => ({ room_id: room.id, user_id: uid }));
    const { error: partError } = await supabase.from("chat_room_participants").insert(participants);
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
        return profiles.find((p) => p.id === otherParticipant.user_id)?.full_name || "Личный чат";
      }
    }
    return room.is_group ? "Групповой чат" : "Личный чат";
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex max-h-[80vh] w-[95vw] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl sm:h-[560px] sm:w-[480px]">
          <div className="grid h-full grid-cols-[160px_1fr] overflow-hidden">
            <div className="border-r bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Чаты</h2>
                {isAdmin && (
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7">
                        <Plus className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Создать новый чат</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Название группы</label>
                          <Input
                            placeholder="Напр. Смена А"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Участники</label>
                          <ScrollArea className="h-48 rounded-md border p-2">
                            <div className="space-y-2">
                              {profiles?.filter((p) => p.id !== user?.id).map((p) => (
                                <div key={p.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={p.id}
                                    checked={selectedUsers.includes(p.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedUsers((prev) =>
                                        checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                                      );
                                    }}
                                  />
                                  <label htmlFor={p.id} className="text-sm">
                                    {p.full_name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={createRoom}>Создать</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="space-y-1">
                <Button
                  variant={selectedRoom === null ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 px-2 py-1.5 h-auto text-sm"
                  onClick={() => setSelectedRoom(null)}
                >
                  <Users className="size-4" />
                  <span className="truncate">Общий чат</span>
                  {getUnreadCount(null) > 0 && (
                    <Badge variant="destructive" className="ml-auto rounded-full px-1.5 py-0 text-[10px]">
                      {getUnreadCount(null)}
                    </Badge>
                  )}
                </Button>
                {rooms?.map((room) => {
                  const isSelected = selectedRoom === room.id;
                  return (
                    <Button
                      key={room.id}
                      variant={isSelected ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2 px-2 py-1.5 h-auto text-sm"
                      onClick={() => setSelectedRoom(room.id)}
                    >
                      {room.is_group ? <Users className="size-4" /> : <User className="size-4" />}
                      <span className="truncate">{getRoomName(room)}</span>
                      {getUnreadCount(room.id) > 0 && (
                        <Badge variant="destructive" className="ml-auto rounded-full px-1.5 py-0 text-[10px]">
                          {getUnreadCount(room.id)}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden bg-background/50">
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {selectedRoom ? (
                      <>
                        {rooms?.find((r) => r.id === selectedRoom)?.is_group ? (
                          <Users className="size-4" />
                        ) : (
                          <User className="size-4" />
                        )}
                        {getRoomName(rooms?.find((r) => r.id === selectedRoom))}
                      </>
                    ) : (
                      <>
                        <Users className="size-4" />
                        Общий чат
                      </>
                    )}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`size-8 ${isSearchOpen ? "bg-accent" : ""}`}
                      onClick={() => setIsSearchOpen(!isSearchOpen)}
                    >
                      <Search className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
                {isSearchOpen && (
                  <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-2">
                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        placeholder="Поиск по тексту"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="h-8 text-sm"
                      />
                      <Select value={searchUserId} onValueChange={setSearchUserId}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Все пользователи" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все пользователи</SelectItem>
                          {profiles?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`h-8 w-full justify-start text-left font-normal text-sm ${
                              !searchDate && "text-muted-foreground"
                            }`}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {searchDate ? format(searchDate, "dd.MM.yyyy") : "Выберите дату"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={searchDate}
                            onSelect={setSearchDate}
                            initialFocus
                            locale={ru}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={clearSearch}>
                        Сбросить
                      </Button>
                      <Button size="sm" onClick={handleSearch}>
                        Найти
                      </Button>
                    </div>
                  </div>
                )}
                {!isSearchOpen && (
                  <p className="text-xs text-muted-foreground">
                    {selectedRoom ? "Личное или групповое обсуждение" : "Общение всей команды в реальном времени"}
                  </p>
                )}
              </div>

              <ScrollArea className="flex-1 p-4">
                {isSearching && (
                  <div className="mb-3 flex items-center justify-between rounded border bg-accent/20 p-2">
                    <span className="text-sm font-medium">Результаты: {searchResults.length}</span>
                    <Button variant="link" size="sm" onClick={() => setIsSearching(false)}>
                      Вернуться
                    </Button>
                  </div>
                )}
                {((isSearching ? searchResults : chatData?.messages) ?? []).length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    {isSearching ? "Ничего не найдено." : "Сообщений пока нет — начните обсуждение."}
                  </p>
                )}
                {((isSearching ? searchResults : chatData?.messages) ?? []).map((m) => {
                  const mine = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} mb-3`}>
                      <div
                        className={`group max-w-[85%] rounded-2xl px-3.5 py-2 ${
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
                        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {(m.attachments as any[]).map((file: any, idx: number) => (
                              <div key={idx} className="rounded border bg-background/10 p-2">
                                {file.type?.startsWith("image/") ? (
                                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={file.url}
                                      alt={file.name}
                                      className="max-h-32 rounded object-contain"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs hover:underline"
                                  >
                                    <FileIcon className="size-4" />
                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                    <span className="opacity-60">({(file.size / 1024).toFixed(1)} KB)</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
              </ScrollArea>

              <div className="border-t p-3 space-y-2">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        className="relative group flex max-w-[160px] items-center gap-2 rounded bg-secondary p-2"
                      >
                        {a.file.type.startsWith("image/") ? (
                          <ImageIcon className="size-4 shrink-0" />
                        ) : (
                          <FileIcon className="size-4 shrink-0" />
                        )}
                        <span className="text-xs truncate">{a.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="absolute -top-2 -right-2 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={send} className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    aria-label="Прикрепить файл"
                    title="Прикрепить файл"
                    className="shrink-0"
                  >
                    <Paperclip className="size-4" />
                  </Button>
                  <Input
                    ref={messageInputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Сообщение…"
                    disabled={isUploading}
                    className="min-w-0"
                  />
                  <EmojiPicker disabled={isUploading} onSelect={insertEmoji} />

                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Отправить"
                    title="Отправить сообщение (Enter)"
                    disabled={isUploading}
                    className="shrink-0"
                  >
                    <Send className={`size-4 ${isUploading ? "animate-pulse" : ""}`} />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={toggleOpen}
        size="icon"
        className="relative h-14 w-14 rounded-full shadow-lg"
        aria-label={isOpen ? "Закрыть чат" : "Открыть чат"}
        title={isOpen ? "Закрыть чат" : "Открыть чат команды"}
      >
        {isOpen ? <X className="size-6" /> : <MessageSquare className="size-6" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
    </div>
  );
}
