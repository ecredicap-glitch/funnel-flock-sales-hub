import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/cadencias")({
  head: () => ({
    meta: [
      { title: "Cadências — ZapPilot" },
      { name: "description", content: "Sequências automáticas de follow-up que param quando o lead responde." },
      { property: "og:title", content: "Cadências — ZapPilot" },
      { property: "og:description", content: "Sequências automáticas de follow-up que param quando o lead responde." },
    ],
  }),
  component: CadenciasPage,
});

function CadenciasPage() {
  return (
    <ModulePlaceholder
      eyebrow="Automação"
      title="Cadências"
      description="Sequências automáticas de follow-up que param quando o lead responde."
      icon={Workflow}
      emptyTitle="Nenhuma cadência ativa"
      emptyDescription="Monte sequências como Mensagem → Espera → Condição (respondeu?) → Próxima mensagem. A cadência para sozinha se o lead responder ou pedir para sair."
      stage={6}
      features={["Construtor visual simples", "Esperas em horas ou dias", "Condição respondeu sim/não", "Parada automática em resposta ou opt-out"]}
      next={{ label: "Ver templates", to: "/templates" }}
    />
  );
}
