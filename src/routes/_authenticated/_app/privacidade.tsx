import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade & LGPD — ZapPilot" },
      { name: "description", content: "Auditoria, direitos do titular e texto de descadastro." },
      { property: "og:title", content: "Privacidade & LGPD — ZapPilot" },
      { property: "og:description", content: "Auditoria, direitos do titular e texto de descadastro." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <ModulePlaceholder
      eyebrow="Conformidade"
      title="Privacidade & LGPD"
      description="Auditoria, direitos do titular e texto de descadastro."
      icon={ShieldCheck}
      emptyTitle="Nada registrado ainda"
      emptyDescription="Todas as ações da equipe ficarão registradas aqui. Você poderá exportar ou excluir os dados de um contato a pedido dele."
      stage={7}
      features={["Log de auditoria (quem fez o quê e quando)", "Exportação e exclusão de dados do contato", "Texto padrão de opt-out editável", "Opt-out automático por 'SAIR', 'PARAR' e similares"]}
      next={undefined}
    />
  );
}
