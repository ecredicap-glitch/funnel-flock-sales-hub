import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, QrCode, Send, Smartphone, Unplug, ShieldCheck, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { sendTestMessage, whatsappAction, type WaState } from "@/lib/whatsapp.functions";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { HealthRing } from "@/components/app/HealthRing";
import { calculateChipHealth } from "@/lib/chip-health";
import { supabase } from "@/integrations/supabase/client";
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

  const metricsQuery = useQuery({
    queryKey: ["ws_metrics_brief", wsId],
    enabled: !!wsId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("workspace_metrics", { _ws: wsId, _days: 1 });
      if (error) return null;
      return res as any;
    },
  });

  const [showTips, setShowTips] = useState(false);

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
  const isConnected = s === "open";
  const metrics = metricsQuery.data;
  const chipHealth = calculateChipHealth({
    connected: isConnected,
    sentToday: metrics?.sent_today ?? 0,
    failedToday: metrics?.camp_failed ?? 0,
    dailyLimit: metrics?.daily_limit ?? 20,
    optouts: metrics?.optouts ?? 0,
  });

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

      {/* Painel de Saúde do Chip */}
      <section className="glass mt-6 max-w-3xl rounded-3xl p-6 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <HealthRing value={isConnected ? chipHealth.score : null} size={80} />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Saúde do Chip</h3>
                <Badge variant={chipHealth.badgeVariant} className="rounded-md uppercase text-[10px] tracking-wider">
                  {chipHealth.statusLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-md">{chipHealth.reason}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-muted-foreground">
                <span>Fase: <strong className="text-foreground">{chipHealth.warmupLabel}</strong></span>
                <span>•</span>
                <span>Falhas 24h: <strong className="text-foreground">{Math.round(chipHealth.failRate * 100)}%</strong></span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs"
            onClick={() => setShowTips((prev) => !prev)}
          >
            <ShieldCheck className="mr-1.5 size-3.5 text-primary" />
            {showTips ? "Ocultar Dicas" : "Dicas Preventivas"}
          </Button>
        </div>

        {showTips && (
          <div className="mt-4 rounded-2xl border bg-muted/20 p-4 space-y-2 animate-fade-in text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="size-4 text-primary" /> Boas práticas para evitar bloqueios no WhatsApp:
            </p>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              {chipHealth.suggestions.map((sug, idx) => (
                <li key={idx}>{sug}</li>
              ))}
              <li>Nunca faça disparos sem consentimento (opt-in) prévio dos contatos.</li>
              <li>Mantenha o horário comercial configurado para evitar denúncias de incômodo noturno.</li>
            </ul>
          </div>
        )}
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
