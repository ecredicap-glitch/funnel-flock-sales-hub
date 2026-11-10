import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div className="space-y-1">
        {eyebrow && (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-ink">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
