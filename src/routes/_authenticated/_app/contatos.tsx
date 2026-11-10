import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/_app/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos e listas — ZapPilot" },
      { name: "description", content: "Importe, organize e segmente contatos com consentimento (opt-in)." },
      { property: "og:title", content: "Contatos e listas — ZapPilot" },
      { property: "og:description", content: "Importe, organize e segmente contatos com consentimento (opt-in)." },
    ],
  }),
  component: ContatosPage,
});

function ContatosPage() {
  return (
    <ModulePlaceholder
      eyebrow="Base de contatos"
      title="Contatos e listas"
      description="Importe, organize e segmente contatos com consentimento (opt-in)."
      icon={Users}
      emptyTitle="Sua base está vazia"
      emptyDescription="Importe uma planilha CSV/XLSX. Telefones são normalizados para 55 + DDD + número, duplicados são removidos e contatos sem opt-in ficam fora das campanhas."
      stage={2}
      features={["Importação CSV/XLSX com mapeamento de colunas", "Normalização, deduplicação e validação de telefone", "Tags, listas e campos personalizados", "Opt-in obrigatório (origem e data)", "Aba de bloqueados e descadastrados"]}
      next={undefined}
    />
  );
}
