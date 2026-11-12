import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, QrCode, Smartphone, Unplug } from "lucide-react";
import { whatsappAction, type WaState } from "@/lib/whatsapp.functions";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";

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
              <p className="font-bold">Status: {isLoading ? "verificando…" : LABEL[s]}</p>
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
    </>
  );
}
