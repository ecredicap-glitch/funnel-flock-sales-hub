import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Sparkles, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendInboxReply, setupInboxWebhook } from "@/lib/inbox.functions";
import { classifyMessage } from "@/lib/ai.functions";
import { formatPhone } from "@/lib/phone";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Msg = { id: string; phone: string; push_name: string | null; direction: string; body: string; read: boolean; created_at: string };

export function Inbox({ ws, isAdmin }: { ws: string; isAdmin: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"send" | "ai" | "hook" | null>(null);
  const send = useServerFn(sendInboxReply);
  const hook = useServerFn(setupInboxWebhook);
  const classify = useServerFn(classifyMessage);

  const load = useCallback(async () => {
    const { data } = await supabase.from("wa_messages").select("id,phone,push_name,direction,body,read,created_at").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(1000);
    setMsgs((data ?? []) as Msg[]);
  }, [ws]);

  useEffect(() => {
    if (!ws) return;
    load();
    const ch = supabase.channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages", filter: `workspace_id=eq.${ws}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ws, load]);

  const convs = useMemo(() => {
    const m = new Map<string, { phone: string; name: string | null; last: Msg; unread: number }>();
    for (const x of msgs) {
      const c = m.get(x.phone) ?? { phone: x.phone, name: null, last: x, unread: 0 };
      if (!c.name && x.push_name) c.name = x.push_name;
      if (x.direction === "in" && !x.read) c.unread++;
      m.set(x.phone, c);
    }
    return [...m.values()];
  }, [msgs]);

  const thread = useMemo(() => msgs.filter((x) => x.phone === sel).reverse(), [msgs, sel]);

  async function open(phone: string) {
    setSel(phone); setText("");
    await supabase.from("wa_messages").update({ read: true }).eq("workspace_id", ws).eq("phone", phone).eq("read", false);
  }
  async function reply() {
    if (!sel) return;
    setBusy("send");
    const r = await send({ data: { workspaceId: ws, phone: sel, text } }).catch(() => ({ ok: false, error: "Falha de conexão." }));
    setBusy(null);
    if (!r.ok) toast.error(r.error ?? "Falha ao enviar."); else { setText(""); load(); }
  }
  async function suggest() {
    const last = [...thread].reverse().find((x) => x.direction === "in");
    if (!last) return;
    setBusy("ai");
    try {
      const r = await classify({ data: { workspaceId: ws, message: last.body } });
      if (r.result) { setText(r.result.suggested_reply); toast.success(`Intenção: ${r.result.intent} — ${r.result.next_action}`); } else toast.error(r.error ?? "Falha na IA.");
    } catch { toast.error("Falha na IA."); }
    setBusy(null);
  }
  async function activate() {
    setBusy("hook");
    const r = await hook({ data: { workspaceId: ws } }).catch(() => ({ ok: false, error: "Falha de conexão." }));
    setBusy(null);
    if (r.ok) toast.success("Recebimento ativado. As novas mensagens vão aparecer aqui."); else toast.error(r.error ?? "Falha.");
  }

  const hasIn = thread.some((x) => x.direction === "in");
  return (
    <section className="glass mb-6 max-w-5xl rounded-3xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 font-semibold">Mensagens recebidas
          <InfoTip>As mensagens que os clientes mandam para o seu WhatsApp aparecem aqui sozinhas. Se o cliente responder SAIR ou PARAR, ele é descadastrado na hora.</InfoTip>
        </p>
        <DisabledReason reason={isAdmin ? null : "Apenas administradores podem ativar o recebimento."}>
          <Button size="sm" variant="outline" disabled={!isAdmin || busy === "hook"} onClick={activate}>{busy === "hook" ? <Loader2 className="animate-spin" /> : <Webhook />} Ativar recebimento</Button>
        </DisabledReason>
      </div>
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <ul className="max-h-[420px] space-y-1 overflow-y-auto">
          {convs.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhuma mensagem ainda. Clique em "Ativar recebimento" uma vez e peça para alguém mandar uma mensagem ao seu número.</li>}
          {convs.map((c) => (
            <li key={c.phone}>
              <button onClick={() => open(c.phone)} className={`w-full rounded-2xl p-3 text-left transition hover:bg-muted ${sel === c.phone ? "bg-muted" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.name ?? formatPhone(c.phone)}</span>
                  {c.unread > 0 && <span className="rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{c.unread}</span>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.last.direction === "out" ? "Você: " : ""}{c.last.body}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-h-[320px] flex-col rounded-2xl border p-3">
          {!sel ? <p className="m-auto text-sm text-muted-foreground">Escolha uma conversa.</p> : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto pb-2" style={{ maxHeight: 320 }}>
                {thread.map((x) => (
                  <div key={x.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${x.direction === "out" ? "ml-auto bg-primary/15" : "bg-muted"}`}>
                    <p className="whitespace-pre-wrap">{x.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(x.created_at).toLocaleString("pt-BR", { timeZone: "America/Belem", dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                ))}
              </div>
              <Textarea rows={3} placeholder="Escreva a resposta…" value={text} onChange={(e) => setText(e.target.value)} />
              <div className="mt-2 flex flex-wrap gap-2">
                <DisabledReason reason={hasIn ? null : "O cliente ainda não mandou mensagem para a IA analisar."}>
                  <Button size="sm" variant="outline" disabled={!hasIn || !!busy} onClick={suggest}>{busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Sugerir resposta com IA</Button>
                </DisabledReason>
                <DisabledReason reason={text.trim() ? null : "Escreva uma resposta primeiro."}>
                  <Button size="sm" disabled={!text.trim() || !!busy} onClick={reply}>{busy === "send" ? <Loader2 className="animate-spin" /> : <Send />} Enviar</Button>
                </DisabledReason>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
