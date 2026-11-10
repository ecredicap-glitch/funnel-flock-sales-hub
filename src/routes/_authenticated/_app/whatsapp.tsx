import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — ZapPilot" },
      { name: "description", content: "Conecte e monitore seus números, cada um com limite diário e saúde próprios." },
      { property: "og:title", content: "WhatsApp — ZapPilot" },
      { property: "og:description", content: "Conecte e monitore seus números, cada um com limite diário e saúde próprios." },
    ],
  }),
  component: WhatsappPage,
});

function WhatsappPage() {
  return (
    <ModulePlaceholder
      eyebrow="Conexão"
      title="WhatsApp"
      description="Conecte e monitore seus números, cada um com limite diário e saúde próprios."
      icon={Smartphone}
      emptyTitle="Nenhum número conectado"
      emptyDescription="Crie uma instância, leia o QR Code com o WhatsApp do celular e acompanhe o status em tempo real."
      stage={3}
      features={["Criar instância e QR Code com atualização automática", "Status em tempo real, desconectar e reconectar", "Múltiplos números com limite diário e aquecimento", "Provedor Evolution API configurável (URL + chave no servidor)"]}
      next={{ label: "Configurar gateway", to: "/configuracoes" }}
    />
  );
}
