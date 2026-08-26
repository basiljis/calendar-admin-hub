import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Оборачивает элемент всплывающей подсказкой. */
export function Hint({
  label,
  description,
  side = "right",
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[220px]">
        <p className="font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs opacity-80">{description}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Иконка «?» с пояснением — для подписей полей и заголовков разделов. */
export function HelpHint({
  text,
  side = "top",
  className = "",
}: {
  text: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Подсказка"
          className={`inline-flex items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full ${className}`}
        >
          <HelpCircle className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
