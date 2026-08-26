import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Подписанная ссылка на фото профиля (хранилище приватное). */
export function useAvatarUrl(path?: string | null) {
  const { data } = useQuery({
    queryKey: ["avatar-url", path],
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return data ?? undefined;
}

export function getInitials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

interface UserAvatarProps {
  name?: string | null | undefined;
  avatarPath?: string | null | undefined;
  className?: string | undefined;
  fallbackClassName?: string | undefined;
}

export function UserAvatar({ name, avatarPath, className, fallbackClassName }: UserAvatarProps) {
  const url = useAvatarUrl(avatarPath);
  return (
    <Avatar className={cn("size-8", className)}>
      {url && <AvatarImage src={url} alt={name || "Фото профиля"} />}
      <AvatarFallback className={cn("bg-primary/10 text-primary text-[11px] font-semibold", fallbackClassName)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
