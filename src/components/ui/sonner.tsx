import { Toaster as Sonner } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const iconWrap =
  "flex size-9 shrink-0 items-center justify-center rounded-full";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      gap={12}
      offset={20}
      icons={{
        success: (
          <span className={`${iconWrap} bg-emerald-500/12 text-emerald-600 dark:text-emerald-400`}>
            <CheckCircle2 className="size-5" />
          </span>
        ),
        error: (
          <span className={`${iconWrap} bg-destructive/12 text-destructive`}>
            <XCircle className="size-5" />
          </span>
        ),
        warning: (
          <span className={`${iconWrap} bg-amber-500/15 text-amber-600 dark:text-amber-400`}>
            <AlertTriangle className="size-5" />
          </span>
        ),
        info: (
          <span className={`${iconWrap} bg-primary/12 text-primary`}>
            <Info className="size-5" />
          </span>
        ),
        loading: (
          <span className={`${iconWrap} bg-muted text-muted-foreground`}>
            <Loader2 className="size-5 animate-spin" />
          </span>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:rounded-2xl group-[.toaster]:shadow-[0_12px_32px_-12px_rgba(16,24,40,0.28)] group-[.toaster]:p-4 group-[.toaster]:gap-3 group-[.toaster]:items-start",
          icon: "group-[.toast]:m-0 group-[.toast]:size-9",
          content: "group-[.toast]:gap-1",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:border group-[.toast]:border-primary/30 group-[.toast]:bg-primary/10 group-[.toast]:text-primary group-[.toast]:font-medium group-[.toast]:px-3 group-[.toast]:h-8",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:border group-[.toast]:border-border group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:px-3 group-[.toast]:h-8",
          closeButton:
            "group-[.toast]:bg-card group-[.toast]:border-border group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, CalendarDays as ToastCalendarIcon };
