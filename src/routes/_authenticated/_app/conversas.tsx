import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { classifyMessage, type Classification, type Intent } from "@/lib/ai.functions";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/app/PageHeader";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Inbox } from "@/components/app/Inbox";

export const Route = createFileRoute("/_authenticated/_app/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas — ZapPilot" },
      { name: "description", content: "Classifique com IA as mensagens dos clientes e receba a próxima ação comercial recomendada." },
      { property: "og:title", content: "Conversas — ZapPilot" },
      { property: "og:description", content: "Classifique com IA as mensagens dos clientes e receba a próxima ação comercial recomendada." },
    ],
  }),
  component: ConversasPage,
});

const LABEL: Record<Intent, string> = { interessado: "Interessado", duvida: "Dúvida", objecao: "Objeção", sem_interesse: "Sem interesse", descadastro: "Pediu descadastro", outros: "Outros" };

function ConversasPage() {
  const { current } = useWorkspace();
  const ws = current?.workspace.id ?? "";
  const classify = useServerFn(classifyMessage);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Classification | null>(null);
  const reason = !msg.trim() ? "Cole a mensagem que o cliente enviou." : null;

  async function go() {
    setBusy(true); setRes(null);
    try {
      const r = await classify({ data: { workspaceId: ws, message: msg } });
      if (r.error || !r.result) toast.error(r.error ?? "Falha ao classificar."); else setRes(r.result);
    } catch { toast.error("Falha ao falar com a IA."); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader eyebrow="Caixa de entrada" title="Conversas" description="Mensagens dos clientes chegando em tempo real, com resposta sugerida pela IA." />
      {ws && <Inbox ws={ws} isAdmin={current?.role === "admin"} />}
      <section className="glass grid max-w-5xl gap-6 rounded-3xl p-6 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="flex items-center gap-1 font-semibold">Classificar mensagem recebida
            <InfoTip>A IA lê a mensagem e identifica se o cliente está interessado, com dúvida, com objeção, sem interesse ou pedindo para sair. Depois sugere a próxima ação e uma resposta pronta.</InfoTip>
          </p>
          <Textarea rows={8} placeholder="Ex.: Oi, vi a mensagem de vocês. Quanto fica a parcela de um consórcio de 50 mil?" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <DisabledReason reason={reason}>
            <Button disabled={!!reason || busy || !ws} onClick={go}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Classificar com IA</Button>
          </DisabledReason>
        </div>
        <div className="space-y-3">
          {!res && !busy && <p className="text-sm text-muted-foreground">O resultado aparece aqui.</p>}
          {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Analisando…</p>}
          {res && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${res.intent === "descadastro" || res.intent === "sem_interesse" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{LABEL[res.intent]}</span>
                <span className="text-xs text-muted-foreground">confiança {Math.round(res.confidence * 100)}%</span>
              </div>
              <p className="text-sm">{res.summary}</p>
              <div className="rounded-2xl border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próxima ação recomendada</p>
                <p className="text-sm">{res.next_action}</p>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-primary/15 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Resposta sugerida</p>
                <p className="whitespace-pre-wrap text-sm">{res.suggested_reply}</p>
                <Button className="mt-2" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(res.suggested_reply); toast.success("Resposta copiada."); }}><Copy /> Copiar</Button>
              </div>
              {res.intent === "descadastro" && <p className="text-xs text-destructive">Marque este contato como descadastrado em Contatos para ele não receber novos envios.</p>}
            </>
          )}
        </div>
      </section>
    </>
  );
}
