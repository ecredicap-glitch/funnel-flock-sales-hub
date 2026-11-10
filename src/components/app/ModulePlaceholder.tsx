import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

/** Module page shell used until the module's build stage ships. */
export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  stage,
  features,
  next,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  stage: number;
  features: string[];
  next?: { label: string; to: "/whatsapp" | "/contatos" | "/templates" | "/campanhas" | "/configuracoes" } | undefined;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="glass rounded-3xl animate-fade-up">
          <EmptyState icon={icon} title={emptyTitle} description={emptyDescription}>
            {next && (
              <Button asChild variant="hero">
                <Link to={next.to}>{next.label}</Link>
              </Button>
            )}
          </EmptyState>
        </section>
        <aside className="glass rounded-3xl p-6 animate-fade-up [animation-delay:80ms]">
          <span className="inline-flex items-center gap-2 rounded-full bg-electric/15 px-3 py-1 text-xs font-semibold text-electric">
            Etapa {stage} do roteiro
          </span>
          <h2 className="mt-4 text-base font-bold">O que vem neste módulo</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            {features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-ink" />
                {f}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
