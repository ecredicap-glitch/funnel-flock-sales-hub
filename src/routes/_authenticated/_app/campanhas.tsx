import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pause, Play, Plus, X, Loader2, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateVariations } from "@/lib/ai.functions";
import { TemplatePreview } from "@/components/app/TemplatePreview";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { render } from "@/lib/spintax";
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
  const tpls = useQuery({ queryKey: ["templates", ws], enabled: !!ws, queryFn: async () => (await supabase.from("templates").select("*").eq("workspace_id", ws)).data ?? [] });
  const refresh = () => qc.invalidateQueries({ queryKey: ["campaigns", ws] });
  const num = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => form && setForm({ ...form, [k]: Number(e.target.value) });

  async function create() {
    if (!form || !form.name || !form.list_id || !form.body) { toast.error("Preencha nome, lista e mensagem."); return; }
    setBusy(true);
    try {
      const { data: mem } = await supabase.from("contact_list_members").select("contacts(id,name,phone,city,opt_in,status,custom_fields)").eq("list_id", form.list_id);
      const since = new Date(Date.now() - form.dedupe_days * 86400_000).toISOString();
      const { data: recent } = await supabase.from("campaign_messages").select("phone").eq("workspace_id", ws).eq("status", "sent").gte("sent_at", since);
      const recentSet = new Set((recent ?? []).map((r) => r.phone));
      const seen = new Set<string>();
      const contacts = (mem ?? []).map((m) => m.contacts).filter((c): c is NonNullable<typeof c> => !!c && c.opt_in && c.status === "active" && !recentSet.has(c.phone) && !seen.has(c.phone) && !!seen.add(c.phone));
      if (!contacts.length) { toast.error("Nenhum contato elegível (precisa de opt-in, estar ativo e não ter recebido mensagem recentemente)."); return; }
      const { name, list_id, body, ...rules } = form;
      const { data: camp, error } = await supabase.from("campaigns").insert({ workspace_id: ws, name, list_id, body, ...rules, total: contacts.length, status: "draft" }).select("id").single();
      if (error || !camp) throw error;
      const rows = contacts.map((c) => ({ workspace_id: ws, campaign_id: camp.id, contact_id: c.id, phone: c.phone, body: render(body, { ...((c.custom_fields ?? {}) as Record<string, string>), nome: c.name?.split(" ")[0], cidade: c.city }) }));
      for (let i = 0; i < rows.length; i += 500) { const { error: e } = await supabase.from("campaign_messages").insert(rows.slice(i, i + 500)); if (e) throw e; }
      toast.success(`Campanha criada com ${contacts.length} contatos. Clique em Iniciar.`); setForm(null); refresh();
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
        {camps.data?.map((c) => (
          <article key={c.id} className="glass rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-bold">{c.name}</h3><p className="text-sm text-muted-foreground">{ST[c.status]}{c.pause_reason ? ` — ${c.pause_reason}` : ""}</p></div>
              <div className="flex gap-2">
                {(c.status === "draft" || c.status === "paused") && <Button size="sm" onClick={() => setStatus(c.id, "running")}><Play /> {c.status === "draft" ? "Iniciar" : "Continuar"}</Button>}
                {c.status === "running" && <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "paused")}><Pause /> Pausar</Button>}
                {["draft", "running", "paused"].includes(c.status) && <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "cancelled")}><X /> Cancelar</Button>}
              </div>
            </div>
            <Progress className="mt-4" value={c.total ? ((c.sent + c.failed) / c.total) * 100 : 0} />
            <p className="mt-2 text-xs text-muted-foreground">{c.sent} enviadas · {c.failed} falhas · {c.total} no total</p>
          </article>
        ))}
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
