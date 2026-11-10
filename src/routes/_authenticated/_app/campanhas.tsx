import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — ZapPilot" },
      { name: "description", content: "Envios em massa com fila anti-banimento e acompanhamento em tempo real." },
      { property: "og:title", content: "Campanhas — ZapPilot" },
      { property: "og:description", content: "Envios em massa com fila anti-banimento e acompanhamento em tempo real." },
    ],
  }),
  component: CampanhasPage,
});

function CampanhasPage() {
  return (
    <ModulePlaceholder
      eyebrow="Disparos"
      title="Campanhas"
      description="Envios em massa com fila anti-banimento e acompanhamento em tempo real."
      icon={Megaphone}
      emptyTitle="Nenhuma campanha criada"
      emptyDescription="Crie uma campanha em 4 passos: público → mensagem → regras de envio → revisão. Antes, conecte um número e importe contatos com opt-in."
      stage={4}
      features={["Wizard em 4 passos com agendamento", "Variáveis {{nome}} e variações (spintax) por mensagem", "Anexos: imagem, PDF e áudio", "Progresso em tempo real com pausar, continuar e cancelar", "Relatório e 'Segmentar quem respondeu'"]}
      next={{ label: "Conectar WhatsApp", to: "/whatsapp" }}
    />
  );
}
