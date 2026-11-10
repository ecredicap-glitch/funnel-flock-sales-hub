import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Illustrated empty state: radar rings + icon, title, guidance and next-step actions. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-3 py-8" : "gap-5 py-14",
        className,
      )}
    >
      <div className={cn("relative grid place-items-center", compact ? "size-24" : "size-36")}>
        <svg viewBox="0 0 160 160" className="absolute inset-0 size-full text-border" aria-hidden="true">
          <circle cx="80" cy="80" r="78" fill="none" stroke="currentColor" strokeDasharray="2 6" />
          <circle cx="80" cy="80" r="56" fill="none" stroke="currentColor" />
          <circle cx="80" cy="80" r="34" fill="none" stroke="currentColor" strokeDasharray="4 4" />
          <path d="M80 2v156M2 80h156" stroke="currentColor" strokeWidth="0.6" />
        </svg>
        <span className="absolute right-[14%] top-[18%] size-2 rounded-full bg-electric" />
        <span className="absolute bottom-[20%] left-[12%] size-1.5 rounded-full bg-primary" />
        <span className="absolute inset-[30%] rounded-full bg-primary/20 animate-pulse-ring" />
        <span
          className={cn(
            "relative grid place-items-center rounded-2xl bg-primary text-primary-foreground glow animate-float",
            compact ? "size-11" : "size-14",
          )}
        >
          <Icon className={compact ? "size-5" : "size-6"} />
        </span>
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className={cn("font-bold tracking-tight", compact ? "text-base" : "text-xl")}>{title}</h3>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
