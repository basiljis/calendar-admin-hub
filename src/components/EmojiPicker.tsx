import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const GROUPS: { name: string; emojis: string[] }[] = [
  {
    name: "Часто используемые",
    emojis: ["👍", "👌", "🙏", "👏", "🔥", "✅", "❗", "❤️", "😊", "😂", "🤝", "💪"],
  },
  {
    name: "Смайлики",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
      "😍", "😘", "😗", "😋", "😎", "🤓", "🧐", "🤔", "🤨", "😐", "😑", "😶",
      "🙄", "😏", "😴", "😪", "😫", "😩", "🥱", "😢", "😭", "😤", "😠", "😡",
      "🤯", "😳", "🥳", "😇", "🤗", "🤭", "🤫", "🤥", "😷", "🤒", "🤧", "🥴",
    ],
  },
  {
    name: "Жесты и люди",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤙", "👋", "🙌", "👏", "🙏", "💪",
      "🤝", "✍️", "👀", "🧑‍⚕️", "👨‍💼", "👩‍💼", "🧠", "🫶", "🤲", "☝️",
    ],
  },
  {
    name: "Работа и время",
    emojis: [
      "📅", "🗓️", "⏰", "⌛", "🕒", "📌", "📎", "📁", "📝", "📊", "📈", "📉",
      "💼", "🏥", "🛎️", "☕", "🍽️", "✈️", "🏖️", "🎯", "✅", "❌", "⚠️", "❗",
    ],
  },
  {
    name: "Символы",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "⭐", "🌟", "✨", "🔥", "💯",
      "🎉", "🎊", "🎁", "💤", "💬", "🔔", "🔒", "🔓", "♻️", "➕", "➖", "🆗",
    ],
  },
];

export function EmojiPicker({
  onSelect,
  disabled,
}: {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          aria-label="Вставить смайлик"
          title="Смайлики"
          className="shrink-0"
        >
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <ScrollArea className="h-64">
          <div className="space-y-3 p-3">
            {GROUPS.map((group) => (
              <div key={group.name}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {group.name}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {group.emojis.map((emoji, i) => (
                    <button
                      key={`${group.name}-${emoji}-${i}`}
                      type="button"
                      aria-label={`Смайлик ${emoji}`}
                      onClick={() => {
                        onSelect(emoji);
                        setOpen(false);
                      }}
                      className="rounded-md p-1 text-lg leading-none transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
