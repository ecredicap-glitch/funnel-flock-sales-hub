import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, Plus, X, Loader2, Wand2, Filter, MessageSquareReply, CheckCheck, Eye, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateVariations } from "@/lib/ai.functions";
import { TemplatePreview } from "@/components/app/TemplatePreview";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { render } from "@/lib/spintax";
import { extractFirstName } from "@/lib/contact-name";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — ZapPilot" },
      { name: "description", content: "Envios em massa com fila anti-banimento e acompanhamento em tempo real." },
      { property: "og:title", content: "Campanhas — ZapPilot" },
      { property: "og:description", content: "Envios em massa com fila anti-banimento e acompanhamento em tempo real." },
    ],
  }),
  component: CampanhasPage,
});

const ST: Record<string, string> = { draft: "Rascunho", running: "Enviando", paused: "Pausada", completed: "Concluída", cancelled: "Cancelada" };
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const blank = { name: "", list_id: "", body: "", min_interval_s: 15, max_interval_s: 45, batch_size: 20, batch_pause_min: 3, batch_pause_max: 8, daily_limit: 20, window_start: 8, window_end: 19, window_days: [1, 2, 3, 4, 5, 6], dedupe_days: 7 };

function CampanhasPage() {
  const { current } = useWorkspace();
  const ws = current?.workspace.id ?? "";
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);
  const camps = useQuery({ queryKey: ["campaigns", ws], enabled: !!ws, refetchInterval: 15000,
    queryFn: async () => (await supabase.from("campaigns").select("*").eq("workspace_id", ws).order("created_at", { ascending: false })).data ?? [] });
  const lists = useQuery({ queryKey: ["lists-simple", ws], enabled: !!ws, queryFn: async () => (await supabase.from("contact_lists").select("id,name").eq("workspace_id", ws)).data ?? [] });
  const tpls = useQuery({ queryKey: ["templates", ws], enabled: !!ws, queryFn: async () => (await supabase.from("templates").select("*").eq("workspace_id", ws).neq("category", "autopilot")).data ?? [] });

  type CampMetric = {
    c_id: string;
    n_queued: number;
    n_sent: number;
    n_delivered: number;
    n_read: number;
    n_failed: number;
    n_skipped: number;
    n_replied: number;
  };

  const metricsQuery = useQuery({
    queryKey: ["campaign_metrics", ws],
    enabled: !!ws,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campaign_metrics", { _ws: ws });
      if (error) return {};
      const map: Record<string, CampMetric> = {};
      ((data ?? []) as any[]).forEach((m) => {
        map[m.c_id] = {
          c_id: m.c_id,
          n_queued: Number(m.n_queued || 0),
          n_sent: Number(m.n_sent || 0),
          n_delivered: Number(m.n_delivered || 0),
          n_read: Number(m.n_read || 0),
          n_failed: Number(m.n_failed || 0),
          n_skipped: Number(m.n_skipped || 0),
          n_replied: Number(m.n_replied || 0),
        };
      });
      return map;
    },
  });

  const [segmentingId, setSegmentingId] = useState<string | null>(null);

  async function segmentRepliers(camp: { id: string; name: string }) {
    setSegmentingId(camp.id);
    try {
      const { data: repliedMsgs } = await supabase
        .from("campaign_messages")
        .select("contact_id, phone")
        .eq("campaign_id", camp.id)
        .eq("status", "sent");

      if (!repliedMsgs || repliedMsgs.length === 0) {
        toast.info("Nenhuma mensagem enviada nesta campanha ainda.");
        return;
      }

      const phones = repliedMsgs.map((m) => m.phone);
      const { data: incoming } = await supabase
        .from("wa_messages")
        .select("phone")
        .eq("workspace_id", ws)
        .eq("direction", "in")
        .in("phone", phones);

      const repliedPhones = new Set((incoming ?? []).map((i) => i.phone));
      const contactIds = Array.from(
        new Set(repliedMsgs.filter((m) => repliedPhones.has(m.phone)).map((m) => m.contact_id))
      ).filter(Boolean);

      if (contactIds.length === 0) {
        toast.info("Ainda não há respostas registradas para esta campanha.");
        return;
      }

      const listName = `Respondentes: ${camp.name.slice(0, 25)}`;
      const { data: newList, error: listErr } = await supabase
        .from("contact_lists")
        .insert({ workspace_id: ws, name: listName })
        .select("id")
        .single();

      if (listErr || !newList) throw listErr;

      const members = contactIds.map((cid) => ({ list_id: newList.id, contact_id: cid }));
      const { error: memErr } = await supabase.from("contact_list_members").insert(members);
      if (memErr) throw memErr;

      toast.success(`Lista "${listName}" criada com ${contactIds.length} contatos engajados!`);
      qc.invalidateQueries({ queryKey: ["lists-simple", ws] });
      qc.invalidateQueries({ queryKey: ["contact_lists", ws] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao segmentar contatos.");
    } finally {
      setSegmentingId(null);
    }
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ["campaigns", ws] });
  const num = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => form && setForm({ ...form, [k]: Number(e.target.value) });

  async function create() {
    if (!form || !form.name || !form.list_id || !form.body) { toast.error("Preencha nome, lista e mensagem."); return; }
    setBusy(true);
    try {
      const { data: mem } = await supabase.from("contact_list_members").select("contacts(id,name,phone,city,opt_in,status,custom_fields)").eq("list_id", form.list_id);
      const totalInList = mem?.length ?? 0;
      if (!totalInList) { toast.error("A lista selecionada está vazia."); return; }

      // 1. Deduplicação por dias (filtro temporal recente)
      const since = new Date(Date.now() - form.dedupe_days * 86400_000).toISOString();
      const { data: recent } = await supabase.from("campaign_messages").select("phone").eq("workspace_id", ws).eq("status", "sent").gte("sent_at", since);
      const recentPhones = new Set((recent ?? []).map((r) => r.phone));

      // 2. Anti-repetição da MESMA mensagem (Deduplicação de conteúdo histórico)
      // Normaliza o template base (sem spintax e pontuação excessiva) para comparar conteúdo essencial
      const normalizeText = (t: string) => t.toLowerCase().replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim();
      const currentNormBody = normalizeText(form.body);

      // Busca mensagens enviadas a esses contatos com o mesmo corpo base
      const { data: sameBodyMsgs } = await supabase
        .from("campaign_messages")
        .select("phone, body")
        .eq("workspace_id", ws)
        .eq("status", "sent");

      const sameBodyPhones = new Set(
        (sameBodyMsgs ?? [])
          .filter((m) => normalizeText(m.body) === currentNormBody)
          .map((m) => m.phone)
      );

      const seen = new Set<string>();
      let filteredByRecent = 0;
      let filteredBySameBody = 0;
      let filteredByOptIn = 0;

      const contacts = (mem ?? []).map((m) => m.contacts).filter((c): c is NonNullable<typeof c> => {
        if (!c || c.status !== "active") return false;
        if (!c.opt_in) { filteredByOptIn++; return false; }
        if (seen.has(c.phone)) return false;
        seen.add(c.phone);

        if (recentPhones.has(c.phone)) {
          filteredByRecent++;
          return false;
        }

        if (sameBodyPhones.has(c.phone)) {
          filteredBySameBody++;
          return false;
        }

        return true;
      });

      if (!contacts.length) {
        let msg = "Nenhum contato elegível para envio.";
        if (filteredBySameBody > 0) {
          msg = `${filteredBySameBody} contato(s) já receberam essa mesma mensagem anteriormente. Altere o texto ou use spintax.`;
        } else if (filteredByRecent > 0) {
          msg = `${filteredByRecent} contato(s) já receberam disparo nos últimos ${form.dedupe_days} dias.`;
        } else if (filteredByOptIn > 0) {
          msg = `${filteredByOptIn} contato(s) ignorados por falta de opt-in (LGPD).`;
        }
        toast.error(msg);
        return;
      }

      const { name, list_id, body, ...rules } = form;
      const { data: camp, error } = await supabase.from("campaigns").insert({ workspace_id: ws, name, list_id, body, ...rules, total: contacts.length, status: "draft" }).select("id").single();
      if (error || !camp) throw error;
      const rows = contacts.map((c) => ({
        workspace_id: ws,
        campaign_id: camp.id,
        contact_id: c.id,
        phone: c.phone,
        body: render(body, {
          ...((c.custom_fields ?? {}) as Record<string, string>),
          nome: extractFirstName(c.name),
          cidade: c.city,
        }),
      }));
      for (let i = 0; i < rows.length; i += 500) { const { error: e } = await supabase.from("campaign_messages").insert(rows.slice(i, i + 500)); if (e) throw e; }
      
      let feedback = `Campanha criada com ${contacts.length} contatos elegíveis!`;
      if (filteredByRecent > 0 || filteredBySameBody > 0) {
        feedback += ` (${filteredByRecent} ignorados por envio recente, ${filteredBySameBody} por mensagem idêntica).`;
      }
      toast.success(feedback);
      setForm(null);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erro ao criar campanha."); } finally { setBusy(false); }
  }
  async function setStatus(id: string, status: "running" | "paused" | "cancelled") {
    await supabase.from("campaigns").update({ status, pause_reason: null }).eq("id", id); refresh();
  }

  return (
    <>
      <PageHeader eyebrow="Disparos" title="Campanhas" description="Envio um a um, com intervalos aleatórios, pausas, limite diário e horário permitido (horário de Belém)." />
      {!form && <Button className="mb-4" onClick={() => setForm({ ...blank })}><Plus /> Nova campanha</Button>}
      {form && (
        <section className="glass mb-6 grid gap-6 rounded-3xl p-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Input placeholder="Nome da campanha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })}>
              <option value="">Escolha a lista de contatos…</option>
              {lists.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value="" onChange={(e) => { const t = tpls.data?.find((x) => x.id === e.target.value); if (t) setForm({ ...form, body: t.body }); }}>
              <option value="">Usar um template…</option>
              {tpls.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Textarea rows={6} placeholder="{Olá|Oi} {{nome}}…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <AiWriter ws={ws} onPick={(body) => setForm({ ...form, body })} />
            {form.body && <TemplatePreview body={form.body} />}
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Regras de envio (anti-banimento)</p>
            <Row label="Intervalo entre mensagens (s)"><Input type="number" value={form.min_interval_s} onChange={num("min_interval_s")} /> a <Input type="number" value={form.max_interval_s} onChange={num("max_interval_s")} /></Row>
            <Row label="Pausa a cada (mensagens)"><Input type="number" value={form.batch_size} onChange={num("batch_size")} /></Row>
            <Row label="Duração da pausa (min)"><Input type="number" value={form.batch_pause_min} onChange={num("batch_pause_min")} /> a <Input type="number" value={form.batch_pause_max} onChange={num("batch_pause_max")} /></Row>
            <Row label="Limite diário do número"><Input type="number" value={form.daily_limit} onChange={num("daily_limit")} /></Row>
            <Row label="Horário permitido (h)"><Input type="number" value={form.window_start} onChange={num("window_start")} /> às <Input type="number" value={form.window_end} onChange={num("window_end")} /></Row>
            <div className="flex flex-wrap gap-1">{DAYS.map((d, i) => (
              <Button key={d} size="sm" variant={form.window_days.includes(i) ? "default" : "outline"} onClick={() => setForm({ ...form, window_days: form.window_days.includes(i) ? form.window_days.filter((x) => x !== i) : [...form.window_days, i] })}>{d}</Button>
            ))}</div>
            <Row label="Não repetir contato por (dias)"><Input type="number" value={form.dedupe_days} onChange={num("dedupe_days")} /></Row>
            <p className="text-xs text-muted-foreground">Número novo? Comece com 20/dia e aumente aos poucos. Só entram contatos com opt-in. A campanha pausa sozinha se as falhas passarem de 15% ou o número desconectar.</p>
            <div className="flex gap-2"><Button disabled={busy} onClick={create}>{busy && <Loader2 className="animate-spin" />} Criar campanha</Button><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button></div>
          </div>
        </section>
      )}
      <div className="grid gap-4">
        {camps.data?.length === 0 && !form && <p className="text-muted-foreground">Nenhuma campanha ainda.</p>}
        {camps.data?.map((c) => {
          const m = metricsQuery.data?.[c.id];
          const queued = m?.n_queued ?? Math.max(0, c.total - (c.sent + c.failed));
          const sent = m?.n_sent ?? c.sent;
          const delivered = m?.n_delivered ?? 0;
          const read = m?.n_read ?? 0;
          const replied = m?.n_replied ?? 0;
          const convRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
          const isSegmenting = segmentingId === c.id;

          return (
            <article key={c.id} className="glass rounded-3xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{ST[c.status]}{c.pause_reason ? ` — ${c.pause_reason}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs"
                    disabled={isSegmenting || busy || sent === 0}
                    onClick={() => segmentRepliers(c)}
                  >
                    {isSegmenting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Filter className="mr-1.5 size-3.5 text-primary" />}
                    Segmentar quem respondeu
                  </Button>
                  {(c.status === "draft" || c.status === "paused") && (
                    <Button size="sm" className="rounded-xl text-xs" onClick={() => setStatus(c.id, "running")}>
                      <Play className="mr-1 size-3.5" /> {c.status === "draft" ? "Iniciar" : "Continuar"}
                    </Button>
                  )}
                  {c.status === "running" && (
                    <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => setStatus(c.id, "paused")}>
                      <Pause className="mr-1 size-3.5" /> Pausar
                    </Button>
                  )}
                  {["draft", "running", "paused"].includes(c.status) && (
                    <Button size="sm" variant="ghost" className="rounded-xl text-xs text-muted-foreground hover:text-destructive" onClick={() => setStatus(c.id, "cancelled")}>
                      <X className="mr-1 size-3.5" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>

              <Progress value={c.total ? ((c.sent + c.failed) / c.total) * 100 : 0} className="h-2 rounded-full" />

              {/* Funil Resumido da Campanha */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 rounded-2xl bg-muted/25 p-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]"><Clock className="size-3" /> Fila</span>
                  <p className="font-bold text-foreground font-mono">{queued}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Enviadas</span>
                  <p className="font-bold text-foreground font-mono">{sent}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]"><CheckCheck className="size-3" /> Entregues</span>
                  <p className="font-bold text-foreground font-mono">{delivered}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]"><Eye className="size-3" /> Lidas</span>
                  <p className="font-bold text-foreground font-mono">{read}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]"><MessageSquareReply className="size-3" /> Respostas</span>
                  <p className="font-bold text-primary font-mono">{replied}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Conversão</span>
                  <p className="font-bold text-success font-mono">{convRate}%</p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Total planejado: {c.total} contatos · Falhas: {c.failed}
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex items-center gap-2"><span className="w-56 shrink-0">{label}</span><span className="flex flex-1 items-center gap-2">{children}</span></label>;
}

function AiWriter({ ws, onPick }: { ws: string; onPick: (body: string) => void }) {
  const gen = useServerFn(generateVariations);
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ title: string; body: string }[]>([]);
  const reason = objective.trim().length < 3 ? "Descreva o objetivo da campanha." : audience.trim().length < 3 ? "Descreva o público que autorizou receber mensagens." : null;
  async function go() {
    setBusy(true);
    try {
      const r = await gen({ data: { workspaceId: ws, objective, audience } });
      if (r.error) toast.error(r.error); else setOut(r.variations);
    } catch { toast.error("Falha ao falar com a IA."); }
    setBusy(false);
  }
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Wand2 /> Escrever com IA</Button>;
  return (
    <div className="space-y-2 rounded-2xl border p-3">
      <p className="flex items-center gap-1 text-sm font-semibold">Gerar variações com IA
        <InfoTip>A IA cria 3 mensagens diferentes, já com {"{{nome}}"} e variações {"{a|b}"}, em tom consultivo e sem prometer aprovação. Revise antes de usar.</InfoTip>
      </p>
      <Textarea rows={2} placeholder="Objetivo (ex.: oferecer análise gratuita de crédito consignado)" value={objective} onChange={(e) => setObjective(e.target.value)} />
      <Textarea rows={2} placeholder="Público que consentiu (ex.: aposentados do INSS em Belém que pediram simulação no site)" value={audience} onChange={(e) => setAudience(e.target.value)} />
      <div className="flex gap-2">
        <DisabledReason reason={reason}><Button size="sm" disabled={!!reason || busy} onClick={go}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Gerar 3 variações</Button></DisabledReason>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
      </div>
      {out.map((v, i) => (
        <div key={i} className="rounded-xl bg-muted/40 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-primary">{v.title}</p>
          <p className="whitespace-pre-wrap">{v.body}</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => onPick(v.body)}>Usar esta mensagem</Button>
        </div>
      ))}
    </div>
  );
}
