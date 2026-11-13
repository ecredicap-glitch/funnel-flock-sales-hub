import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { render } from "@/lib/spintax";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/app/InfoTip";

const DEFAULTS: Record<string, string> = { nome: "Maria Souza", cidade: "Belém" };

/** Variáveis {{campo}} usadas no texto, na ordem em que aparecem. */
export function templateVars(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!))];
}

/** Prévia com dados de exemplo editáveis e várias variações do spintax. */
export function TemplatePreview({ body, count = 3 }: { body: string; count?: number }) {
  const vars = useMemo(() => templateVars(body), [body]);
  const [sample, setSample] = useState<Record<string, string>>(DEFAULTS);
  const [seed, setSeed] = useState(0);
  const data = Object.fromEntries(vars.map((v) => [v, v === "nome" ? (sample[v] ?? "").split(" ")[0] : sample[v] ?? ""]));
  const outs = useMemo(() => Array.from({ length: count }, () => render(body || "…", data)), [body, seed, JSON.stringify(data), count]);
  const missing = vars.filter((v) => !(sample[v] ?? "").trim());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-sm font-semibold">Prévia com dados de exemplo
          <InfoTip>Cada contato recebe uma combinação diferente das opções entre chaves {"{a|b}"}. Os campos {"{{nome}}"} etc. são trocados pelos dados do contato. Edite os exemplos abaixo para conferir.</InfoTip>
        </p>
        <Button size="sm" variant="ghost" onClick={() => setSeed(seed + 1)}><Shuffle /> Outras variações</Button>
      </div>
      {vars.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {vars.map((v) => (
            <label key={v} className="text-xs text-muted-foreground">{`{{${v}}}`}
              <Input className="mt-1 h-8" value={sample[v] ?? ""} placeholder={`Exemplo de ${v}`} onChange={(e) => setSample({ ...sample, [v]: e.target.value })} />
            </label>
          ))}
        </div>
      )}
      {missing.length > 0 && <p className="text-xs text-destructive">Sem valor de exemplo: {missing.join(", ")}. Contatos sem esse campo receberão o texto com esse trecho vazio.</p>}
      <div className="space-y-2">
        {outs.map((t, i) => (
          <div key={i} className="max-w-md whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-primary/15 p-3 text-sm">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-primary">Contato {i + 1}</span>{t}
          </div>
        ))}
      </div>
    </div>
  );
}
