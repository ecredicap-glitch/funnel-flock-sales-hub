import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Sparkles,
  Webhook,
  Bot,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendInboxReply, setupInboxWebhook } from "@/lib/inbox.functions";
import { classifyMessage } from "@/lib/ai.functions";
import {
  getAutopilotSettings,
  updateAutopilotSettings,
} from "@/lib/autopilot.functions";
import { formatPhone } from "@/lib/phone";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  phone: string;
  push_name: string | null;
  direction: string;
  body: string;
  read: boolean;
  created_at: string;
};

export function Inbox({ ws, isAdmin }: { ws: string; isAdmin: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"send" | "ai" | "hook" | null>(null);

  // Piloto Automático State
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autopilotInstruction, setAutopilotInstruction] = useState("");
  const [autopilotModalOpen, setAutopilotModalOpen] = useState(false);
  const [savingAutopilotModal, setSavingAutopilotModal] = useState(false);

  const send = useServerFn(sendInboxReply);
  const hook = useServerFn(setupInboxWebhook);
  const classify = useServerFn(classifyMessage);
  const fetchAutopilot = useServerFn(getAutopilotSettings);
  const saveAutopilot = useServerFn(updateAutopilotSettings);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("wa_messages")
      .select("id,phone,push_name,direction,body,read,created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(1000);
    setMsgs((data ?? []) as Msg[]);
  }, [ws]);

  useEffect(() => {
    if (!ws) return;
    load();

    // Carrega configurações do Piloto Automático
    fetchAutopilot({ data: { workspaceId: ws } })
      .then((cfg) => {
        setAutopilotEnabled(cfg.enabled);
        setAutopilotInstruction(cfg.instruction || "");
      })
      .catch(() => {});

    const ch = supabase
      .channel(`inbox-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_messages", filter: `workspace_id=eq.${ws}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
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
    setSel(phone);
    setText("");
    await supabase
      .from("wa_messages")
      .update({ read: true })
      .eq("workspace_id", ws)
      .eq("phone", phone)
      .eq("read", false);
  }

  async function reply() {
    if (!sel) return;
    setBusy("send");
    const r = await send({ data: { workspaceId: ws, phone: sel, text } }).catch(() => ({
      ok: false,
      error: "Falha de conexão.",
    }));
    setBusy(null);
    if (!r.ok) toast.error(r.error ?? "Falha ao enviar.");
    else {
      setText("");
      load();
    }
  }

  async function suggest() {
    const last = [...thread].reverse().find((x) => x.direction === "in");
    if (!last) return;
    setBusy("ai");
    try {
      const r = await classify({ data: { workspaceId: ws, message: last.body } });
      if (r.result) {
        setText(r.result.suggested_reply);
        toast.success(`Intenção: ${r.result.intent} — ${r.result.next_action}`);
        if (r.result.intent === "interessado") {
          const { data: moved } = await supabase
            .from("contacts")
            .update({ stage: "interessado" })
            .eq("workspace_id", ws)
            .eq("phone", last.phone)
            .in("stage", ["novo", "contatado", "respondeu"])
            .select("id");
          if (moved?.length) toast.success("Lead movido para Interessado no Funil.");
        }
      } else toast.error(r.error ?? "Falha na IA.");
    } catch {
      toast.error("Falha na IA.");
    }
    setBusy(null);
  }

  async function activate() {
    setBusy("hook");
    const r = await hook({ data: { workspaceId: ws } }).catch(() => ({ ok: false, error: "Falha de conexão." }));
    setBusy(null);
    if (r.ok) toast.success("Recebimento ativado. As novas mensagens vão aparecer aqui.");
    else toast.error(r.error ?? "Falha.");
  }

  async function toggleAutopilot(nextState: boolean) {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar o modo do Piloto Automático.");
      return;
    }
    setAutopilotEnabled(nextState);
    const res = await saveAutopilot({
      data: {
        workspaceId: ws,
        enabled: nextState,
        instruction: autopilotInstruction,
      },
    }).catch(() => ({ ok: false, error: "Falha ao salvar." }));

    if (res.ok) {
      toast.success(
        nextState
          ? "Piloto Automático 100% ATIVADO! A IA responderá novas mensagens recebidas sozinha."
          : "Modo Copiloto reativado. A IA voltará a sugerir respostas para aprovação humana."
      );
    } else {
      setAutopilotEnabled(!nextState);
      toast.error(res.error || "Erro ao salvar configuração.");
    }
  }

  async function handleSaveInstruction(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingAutopilotModal(true);
    const res = await saveAutopilot({
      data: {
        workspaceId: ws,
        enabled: autopilotEnabled,
        instruction: autopilotInstruction.trim(),
      },
    }).catch(() => ({ ok: false, error: "Falha ao salvar." }));
    setSavingAutopilotModal(false);

    if (res.ok) {
      toast.success("Instruções do Piloto Automático salvas!");
      setAutopilotModalOpen(false);
    } else {
      toast.error(res.error || "Erro ao salvar.");
    }
  }

  const hasIn = thread.some((x) => x.direction === "in");

  return (
    <section className="glass mb-6 max-w-5xl rounded-3xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 font-semibold">
          Mensagens recebidas
          <InfoTip>
            As mensagens que os clientes mandam para o seu WhatsApp aparecem aqui sozinhas. Se o cliente responder SAIR ou
            PARAR, ele é descadastrado na hora.
          </InfoTip>
        </p>
        <DisabledReason reason={isAdmin ? null : "Apenas administradores podem ativar o recebimento."}>
          <Button size="sm" variant="outline" disabled={!isAdmin || busy === "hook"} onClick={activate}>
            {busy === "hook" ? <Loader2 className="animate-spin" /> : <Webhook />} Ativar recebimento
          </Button>
        </DisabledReason>
      </div>

      {/* Interruptor Duplo: Modo Copiloto vs Piloto Automático 100% Autônomo */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-3.5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-9 place-items-center rounded-xl transition-colors",
              autopilotEnabled ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            <Bot className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Piloto Automático (IA Autônoma)</span>
              <Badge
                variant={autopilotEnabled ? "default" : "outline"}
                className={cn("text-[10px] rounded-full", autopilotEnabled && "font-semibold")}
              >
                {autopilotEnabled ? "100% Autônomo Ativo" : "Modo Copiloto (Manual)"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {autopilotEnabled
                ? "A IA responde clientes imediatamente no WhatsApp e avança interessados no Funil."
                : "Modo Copiloto: a IA apenas sugere o texto e você clica em Enviar para responder."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs"
              onClick={() => setAutopilotModalOpen(true)}
            >
              <Settings2 className="mr-1.5 size-3.5" /> Instruções do Robô
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="autopilot-toggle" className="text-xs font-semibold cursor-pointer">
              {autopilotEnabled ? "Ligado" : "Desligado"}
            </Label>
            <Switch
              id="autopilot-toggle"
              checked={autopilotEnabled}
              disabled={!isAdmin}
              onCheckedChange={toggleAutopilot}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <ul className="max-h-[420px] space-y-1 overflow-y-auto">
          {convs.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Clique em "Ativar recebimento" uma vez e peça para alguém mandar uma mensagem ao seu
              número.
            </li>
          )}
          {convs.map((c) => (
            <li key={c.phone}>
              <button
                onClick={() => open(c.phone)}
                className={`w-full rounded-2xl p-3 text-left transition hover:bg-muted ${sel === c.phone ? "bg-muted" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.name ?? formatPhone(c.phone)}</span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.last.direction === "out" ? "Você: " : ""}
                  {c.last.body}
                </p>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex min-h-[320px] flex-col rounded-2xl border p-3">
          {!sel ? (
            <p className="m-auto text-sm text-muted-foreground">Escolha uma conversa.</p>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto pb-2" style={{ maxHeight: 320 }}>
                {thread.map((x) => (
                  <div
                    key={x.id}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${x.direction === "out" ? "ml-auto bg-primary/15" : "bg-muted"}`}
                  >
                    <p className="whitespace-pre-wrap">{x.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(x.created_at).toLocaleString("pt-BR", {
                        timeZone: "America/Belem",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>

              <Textarea
                rows={3}
                placeholder="Escreva a resposta…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <DisabledReason reason={hasIn ? null : "O cliente ainda não mandou mensagem para a IA analisar."}>
                  <Button size="sm" variant="outline" disabled={!hasIn || !!busy} onClick={suggest}>
                    {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Sugerir resposta com IA
                  </Button>
                </DisabledReason>
                <DisabledReason reason={text.trim() ? null : "Escreva uma resposta primeiro."}>
                  <Button size="sm" disabled={!text.trim() || !!busy} onClick={reply}>
                    {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />} Enviar
                  </Button>
                </DisabledReason>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Configuração das Instruções do Piloto Automático */}
      <Dialog open={autopilotModalOpen} onOpenChange={setAutopilotModalOpen}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Bot className="size-5" />
              <DialogTitle>Instruções do Piloto Automático (SDR com IA)</DialogTitle>
            </div>
            <DialogDescription>
              Defina como a IA deve conversar com seus leads quando responder de forma autônoma.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveInstruction} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="autopilot-instruction">Prompt de Comportamento e Regras de Negócio</Label>
              <Textarea
                id="autopilot-instruction"
                rows={6}
                value={autopilotInstruction}
                onChange={(e) => setAutopilotInstruction(e.target.value)}
                placeholder="Descreva o tom, produtos, formas de pagamento e limites de aprovação..."
                className="rounded-2xl text-xs leading-relaxed"
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {autopilotInstruction.length} / 2000 caracteres
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-3 text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" /> Boas práticas para o Piloto Automático:
              </p>
              <p>• Mantenha o tom consultivo sem prometer valores ou aprovação garantida.</p>
              <p>• Oriente a IA a pedir para o cliente aguardar o especialista caso a dúvida seja complexa.</p>
              <p>• A IA respeita automaticamente pedidos de opt-out (descadastro).</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setAutopilotModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAutopilotModal} className="rounded-xl">
                {savingAutopilotModal ? "Salvando..." : "Salvar Instruções"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
