import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Ícone (i) com explicação em linguagem simples. */
export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger type="button" aria-label="Mais informações" className="inline-grid size-5 place-items-center rounded-full text-muted-foreground hover:text-primary">
          <Info className="size-4" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Envolve um botão desabilitado e mostra o motivo ao passar o mouse. */
export function DisabledReason({ reason, children }: { reason?: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild><span tabIndex={0} className="inline-flex">{children}</span></TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
