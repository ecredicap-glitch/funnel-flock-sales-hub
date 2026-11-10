import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas — ZapPilot" },
      { name: "description", content: "Chat em tempo real com histórico, notas internas e atribuição a atendentes." },
      { property: "og:title", content: "Conversas — ZapPilot" },
      { property: "og:description", content: "Chat em tempo real com histórico, notas internas e atribuição a atendentes." },
    ],
  }),
  component: ConversasPage,
});

function ConversasPage() {
  return (
    <ModulePlaceholder
      eyebrow="Caixa de entrada"
      title="Conversas"
      description="Chat em tempo real com histórico, notas internas e atribuição a atendentes."
      icon={MessagesSquare}
      emptyTitle="Nenhuma conversa ainda"
      emptyDescription="As respostas dos seus contatos chegam aqui em tempo real, já classificadas por IA. Conecte um número para começar."
      stage={5}
      features={["Chat estilo WhatsApp Web em tempo real", "Classificação por IA: Interessado, Dúvida, Sem interesse, Descadastro, Outros", "Notas internas e atribuição a atendente", "Respostas rápidas salvas"]}
      next={{ label: "Conectar WhatsApp", to: "/whatsapp" }}
    />
  );
}
