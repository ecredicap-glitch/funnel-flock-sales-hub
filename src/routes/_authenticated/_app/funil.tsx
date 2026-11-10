import { createFileRoute } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/funil")({
  head: () => ({
    meta: [
      { title: "Funil — ZapPilot" },
      { name: "description", content: "Leads em colunas editáveis, do primeiro contato ao fechamento." },
      { property: "og:title", content: "Funil — ZapPilot" },
      { property: "og:description", content: "Leads em colunas editáveis, do primeiro contato ao fechamento." },
    ],
  }),
  component: FunilPage,
});

function FunilPage() {
  return (
    <ModulePlaceholder
      eyebrow="Funil de vendas"
      title="Funil"
      description="Leads em colunas editáveis, do primeiro contato ao fechamento."
      icon={KanbanSquare}
      emptyTitle="Seu funil está vazio"
      emptyDescription="Assim que você importar contatos ou receber respostas, os leads aparecem aqui em Novo → Contatado → Respondeu → Interessado → Proposta → Fechado → Perdido."
      stage={6}
      features={["Colunas editáveis com arrastar e soltar", "Card com nome, telefone, origem, última mensagem e produto (Crédito, Consórcio, Limpa Nome, Rating)", "Automação ao mover de coluna (ex.: enviar template ao entrar em Proposta)", "Leads 'Interessados' movidos automaticamente pela IA"]}
      next={{ label: "Importar contatos", to: "/contatos" }}
    />
  );
}
