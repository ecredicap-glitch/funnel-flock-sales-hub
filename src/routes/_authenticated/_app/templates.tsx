import { createFileRoute } from "@tanstack/react-router";
import { LayoutTemplate } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/templates")({
  head: () => ({
    meta: [
      { title: "Templates — ZapPilot" },
      { name: "description", content: "Modelos por categoria com variáveis e variações." },
      { property: "og:title", content: "Templates — ZapPilot" },
      { property: "og:description", content: "Modelos por categoria com variáveis e variações." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <ModulePlaceholder
      eyebrow="Biblioteca"
      title="Templates"
      description="Modelos por categoria com variáveis e variações."
      icon={LayoutTemplate}
      emptyTitle="Nenhum template ainda"
      emptyDescription="A biblioteca virá com 8 modelos para o setor financeiro em tom consultivo, sem promessas de aprovação garantida."
      stage={4}
      features={["Categorias: primeiro contato, follow-up, proposta, reativação", "Variáveis e spintax com pré-visualização em balão", "8 exemplos prontos para crédito, consórcio, limpa nome e rating"]}
      next={undefined}
    />
  );
}
