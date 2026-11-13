import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, QrCode, Send, Smartphone, Unplug } from "lucide-react";
import { sendTestMessage, whatsappAction, type WaState } from "@/lib/whatsapp.functions";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { normalizePhone } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — ZapPilot" },
      { name: "description", content: "Conecte seu número via QR Code e acompanhe o status em tempo real." },
      { property: "og:title", content: "WhatsApp — ZapPilot" },
      { property: "og:description", content: "Conecte seu número via QR Code e acompanhe o status em tempo real." },
    ],
  }),
  component: WhatsappPage,
});

const LABEL: Record<WaState["state"], string> = { open: "Conectado", connecting: "Aguardando leitura do QR Code", close: "Desconectado", none: "Nenhuma instância" };

function WhatsappPage() {
  const { current, isAdmin } = useWorkspace();
  const fn = useServerFn(whatsappAction);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const wsId = current?.workspace.id ?? "";
  const key = ["wa", wsId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!wsId,
    queryFn: () => fn({ data: { workspaceId: wsId, action: "status" } }),
    refetchInterval: (q) => (q.state.data?.state === "connecting" ? 5000 : 20000),
  });

  async function run(action: "connect" | "logout") {
    setBusy(true);
    try {
      const r = await fn({ data: { workspaceId: wsId, action } });
      if (r.error) toast.error(r.error);
      qc.setQueryData(key, r);
    } catch { toast.error("Falha ao falar com o gateway."); }
    setBusy(false);
  }

  const s = data?.state ?? "none";
  return (
    <>
      <PageHeader eyebrow="Conexão" title="WhatsApp" description="Conecte o número da empresa lendo o QR Code no celular (Aparelhos conectados)." />
      <section className="glass max-w-3xl rounded-3xl p-6 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary"><Smartphone className="size-5" /></div>
            <div>
              <p className="flex items-center gap-1 font-bold"><InfoTip>O ZapPilot usa o seu número como um "aparelho conectado", igual ao WhatsApp Web. Conectado = pronto para enviar.</InfoTip>Status: {isLoading ? "verificando…" : LABEL[s]}</p>
              {data?.number && <p className="text-sm text-muted-foreground font-mono">+{data.number}</p>}
            </div>
          </div>
          {isAdmin && (s === "open" ? (
            <Button variant="outline" disabled={busy} onClick={() => run("logout")}>{busy ? <Loader2 className="animate-spin" /> : <Unplug />} Desconectar</Button>
          ) : (
            <Button disabled={busy || !wsId} onClick={() => run("connect")}>{busy ? <Loader2 className="animate-spin" /> : <QrCode />} {s === "connecting" ? "Gerar novo QR Code" : "Conectar número"}</Button>
          ))}
        </div>
        {s === "connecting" && data?.qr && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <img src={data.qr} alt="QR Code do WhatsApp" className="size-64 rounded-2xl bg-card p-3" />
            <p className="text-center text-sm text-muted-foreground">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O status atualiza sozinho.</p>
          </div>
        )}
        {!isAdmin && <p className="mt-4 text-sm text-muted-foreground">Apenas administradores conectam ou desconectam o número.</p>}
      </section>
      <QuickTest wsId={wsId} connected={s === "open"} isAdmin={isAdmin} />
    </>
  );
}

function QuickTest({ wsId, connected, isAdmin }: { wsId: string; connected: boolean; isAdmin: boolean }) {
  const send = useServerFn(sendTestMessage);
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("Olá! Esta é uma mensagem de teste do ZapPilot.");
  const [busy, setBusy] = useState(false);
  const norm = normalizePhone(phone);
  const reason = !isAdmin ? "Apenas administradores podem enviar testes."
    : !connected ? "Conecte o número acima (status \"Conectado\") para liberar o teste."
    : !norm ? "Digite um celular válido com DDD, ex.: 91 98888-7777."
    : !text.trim() ? "Escreva a mensagem de teste." : null;
  async function go() {
    if (!norm) return;
    setBusy(true);
    try {
      const r = await send({ data: { workspaceId: wsId, phone: norm, text: text.trim() } });
      if (r.ok) toast.success("Mensagem de teste enviada!"); else toast.error(r.error ?? "Falha no envio.");
    } catch { toast.error("Falha ao falar com o gateway."); }
    setBusy(false);
  }
  return (
    <section className="glass mt-6 max-w-3xl rounded-3xl p-6 animate-fade-up">
      <h2 className="flex items-center gap-2 text-lg font-bold">Disparo de teste rápido
        <InfoTip>Envia uma única mensagem agora para conferir se a entrega funciona, sem criar lista nem campanha. Use o seu próprio número.</InfoTip>
      </h2>
      <div className="mt-4 grid gap-3">
        <Input placeholder="DDD + número (ex.: 91 98888-7777)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div><DisabledReason reason={reason}>
          <Button disabled={!!reason || busy} onClick={go}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Enviar teste</Button>
        </DisabledReason></div>
        {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      </div>
    </section>
  );
}
