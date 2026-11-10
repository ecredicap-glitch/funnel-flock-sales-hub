import { createFileRoute } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/planos")({
  head: () => ({
    meta: [
      { title: "Planos e créditos — ZapPilot" },
      { name: "description", content: "Saldo de mensagens, validade e consumo por campanha." },
      { property: "og:title", content: "Planos e créditos — ZapPilot" },
      { property: "og:description", content: "Saldo de mensagens, validade e consumo por campanha." },
    ],
  }),
  component: PlanosPage,
});

function PlanosPage() {
  return (
    <ModulePlaceholder
      eyebrow="Conta"
      title="Planos e créditos"
      description="Saldo de mensagens, validade e consumo por campanha."
      icon={Coins}
      emptyTitle="Sem créditos lançados"
      emptyDescription="O controle interno de mensagens mostrará saldo, validade, consumo por campanha e alerta de saldo baixo."
      stage={7}
      features={["Saldo e validade de créditos", "Consumo por campanha", "Alerta de saldo baixo", "Estrutura pronta para cobrança futura"]}
      next={undefined}
    />
  );
}
