import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";

interface ProfilePhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName?: string | null | undefined;
  avatarPath?: string | null | undefined;
  onSaved?: (() => void) | undefined;
}

export function ProfilePhotoDialog({
  open,
  onOpenChange,
  userId,
  fullName,
  avatarPath,
  onSaved,
}: ProfilePhotoDialogProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["avatar-url"] });
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["chat-profiles"] });
    onSaved?.();
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5 МБ");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (dbErr) throw dbErr;

      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
      toast.success("Фото профиля обновлено");
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error("Не удалось загрузить фото");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
      toast.success("Фото удалено");
      refresh();
    } catch {
      toast.error("Не удалось удалить фото");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Фото профиля</DialogTitle>
          <DialogDescription>
            Фото отображается в чате, в календаре и в шапке приложения. До 5 МБ.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <UserAvatar
            name={fullName}
            avatarPath={avatarPath}
            className="size-24 border-2 border-primary/15"
            fallbackClassName="text-xl"
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {avatarPath ? (
            <Button variant="outline" onClick={handleRemove} disabled={busy}>
              <Trash2 className="mr-2 size-4" />
              Удалить
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            Загрузить фото
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
