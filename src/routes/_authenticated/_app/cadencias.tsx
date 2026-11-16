import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Workflow, UserPlus, Loader2, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { firstCadenceRun, type CadenceStep } from "@/lib/send-engine";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { InfoTip, DisabledReason } from "@/components/app/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/_app/cadencias")({
  head: () => ({
    meta: [
      { title: "Cadências — ZapPilot" },
      { name: "description", content: "Sequências automáticas de follow-up que param quando o lead responde." },
      { property: "og:title", content: "Cadências — ZapPilot" },
      { property: "og:description", content: "Sequências automáticas de follow-up que param quando o lead responde." },
    ],
  }),
  component: CadenciasPage,
});

const DEFAULT_STEPS: CadenceStep[] = [
  { wait_hours: 0, body: "{Olá|Oi}, {{nome}}! Tudo bem? Aqui é da Ecredi. Vi que você tem interesse em organizar sua vida financeira. Posso te explicar como funciona uma análise sem compromisso?" },
  { wait_hours: 48, body: "{{nome}}, {passando para saber|só para saber} se ficou alguma dúvida. Cada caso é analisado individualmente — quer que eu veja as opções para o seu perfil?" },
  { wait_hours: 96, body: "{{nome}}, esta é minha última mensagem por aqui para não incomodar. Se quiser conversar depois, é só responder. Se não quiser mais receber, responda SAIR." },
];
type Form = { name: string; steps: CadenceStep[]; window_start: number; window_end: number; daily_limit: number };

function CadenciasPage() {
  const { current, isAdmin } = useWorkspace();
  const ws = current?.workspace.id ?? "";
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const cads = useQuery({ queryKey: ["cadences", ws], enabled: !!ws,
    queryFn: async () => (await supabase.from("cadences").select("*").eq("workspace_id", ws).order("created_at", { ascending: false })).data ?? [] });
  const enr = useQuery({ queryKey: ["cad-enr", ws], enabled: !!ws, refetchInterval: 30000,
    queryFn: async () => (await supabase.from("cadence_enrollments").select("cadence_id,status").eq("workspace_id", ws).limit(10000)).data ?? [] });
  const lists = useQuery({ queryKey: ["lists-simple", ws], enabled: !!ws, queryFn: async () => (await supabase.from("contact_lists").select("id,name").eq("workspace_id", ws)).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["cadences", ws] }); qc.invalidateQueries({ queryKey: ["cad-enr", ws] }); };

  const setStep = (i: number, p: Partial<CadenceStep>) => form && setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  async function create() {
    if (!form) return;
    if (!form.name.trim() || form.steps.length === 0 || form.steps.some((s) => !s.body.trim())) { toast.error("Dê um nome e preencha todas as mensagens."); return; }
    setBusy("create");
    const { error } = await supabase.from("cadences").insert({ workspace_id: ws, name: form.name.trim(), steps: form.steps, window_start: form.window_start, window_end: form.window_end, daily_limit: form.daily_limit });
    setBusy(null);
    if (error) { toast.error("Erro ao criar cadência."); return; }
    toast.success("Cadência criada. Agora inscreva uma lista."); setForm(null); refresh();
  }
  async function enroll(c: { id: string; steps: unknown }) {
    const listId = pick[c.id]; if (!listId) return;
    setBusy(c.id);
    try {
      const { data: mem } = await supabase.from("contact_list_members").select("contacts(id,phone,opt_in,status)").eq("list_id", listId);
      const ok = (mem ?? []).map((m) => m.contacts).filter((x): x is NonNullable<typeof x> => !!x && x.opt_in && x.status === "active");
      if (!ok.length) { toast.error("Nenhum contato elegível na lista (precisa de opt-in e estar ativo)."); return; }
      const at = firstCadenceRun(c.steps as CadenceStep[], new Date()).toISOString();
      const rows = ok.map((x) => ({ workspace_id: ws, cadence_id: c.id, contact_id: x.id, phone: x.phone, next_run_at: at }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("cadence_enrollments").upsert(rows.slice(i, i + 500), { onConflict: "cadence_id,contact_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      toast.success(`${ok.length} contatos inscritos. Quem já estava na cadência foi ignorado.`); refresh();
    } catch { toast.error("Erro ao inscrever contatos."); } finally { setBusy(null); }
  }
  async function toggle(id: string, active: boolean) { await supabase.from("cadences").update({ active }).eq("id", id); refresh(); }
  async function remove(id: string) {
    if (!confirm("Excluir esta cadência? Os follow-ups pendentes param.")) return;
    const { error } = await supabase.from("cadences").delete().eq("id", id);
    if (error) toast.error("Não foi possível excluir."); else refresh();
  }

  return (
    <>
      <PageHeader eyebrow="Automação" title="Cadências"
        description={<span className="inline-flex items-center gap-1">Sequências de follow-up enviadas sozinhas, uma de cada vez, dentro do horário permitido.
          <InfoTip>Cada contato recebe a mensagem 1, espera o tempo definido, recebe a 2 e assim por diante. Se o cliente responder ou pedir para sair, a cadência dele para na hora.</InfoTip></span>} />
      {!form && <Button className="mb-4" onClick={() => setForm({ name: "", steps: DEFAULT_STEPS.map((s) => ({ ...s })), window_start: 8, window_end: 19, daily_limit: 30 })}><Plus /> Nova cadência</Button>}

      {form && (
        <section className="glass mb-6 space-y-4 rounded-3xl p-6">
          <Input placeholder="Nome da cadência (ex.: Follow-up Limpa Nome)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <ol className="space-y-3">
            {form.steps.map((s, i) => (
              <li key={i} className="rounded-2xl border bg-muted/30 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="grid size-7 place-items-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <Clock className="size-4 text-muted-foreground" />
                  <span>{i === 0 ? "Enviar após" : "Esperar"}</span>
                  <Input type="number" min={0} className="h-8 w-20" value={s.wait_hours} onChange={(e) => setStep(i, { wait_hours: Number(e.target.value) })} />
                  <span>horas{i === 0 ? " da inscrição" : " após a mensagem anterior"}</span>
                  <InfoTip>Se o horário cair fora da janela permitida, a mensagem espera o próximo horário liberado. 24 h = 1 dia.</InfoTip>
                  {form.steps.length > 1 && <Button size="icon" variant="ghost" className="ml-auto size-8" aria-label="Remover passo" onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}><X /></Button>}
                </div>
                <Textarea rows={3} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} placeholder="Mensagem — use {{nome}} e {opção A|opção B}" />
              </li>
            ))}
          </ol>
          <Button variant="outline" size="sm" onClick={() => setForm({ ...form, steps: [...form.steps, { wait_hours: 48, body: "" }] })}><Plus /> Adicionar passo</Button>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1">Horário<InfoTip>Janela em horário de Belém. Fora dela nada é enviado. Domingos ficam de fora.</InfoTip></span>
            <Input type="number" min={0} max={23} className="h-9 w-16" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: Number(e.target.value) })} />
            <span>às</span>
            <Input type="number" min={1} max={24} className="h-9 w-16" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: Number(e.target.value) })} />
            <span className="ml-4 flex items-center gap-1">Limite por dia<InfoTip>Máximo de follow-ups desta cadência por dia, para proteger seu número.</InfoTip></span>
            <Input type="number" min={1} className="h-9 w-20" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={create} disabled={busy === "create"}>{busy === "create" && <Loader2 className="animate-spin" />} Criar cadência</Button>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </section>
      )}

      {(cads.data ?? []).length === 0 && !form && !cads.isLoading && (
        <EmptyState icon={Workflow} title="Nenhuma cadência ainda" description="Crie uma sequência como Mensagem → espera 48 h → Mensagem 2. Ela para sozinha se o lead responder ou pedir para sair." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(cads.data ?? []).map((c) => {
          const steps = (Array.isArray(c.steps) ? c.steps : []) as CadenceStep[];
          const mine = (enr.data ?? []).filter((e) => e.cadence_id === c.id);
          const n = (s: string) => mine.filter((e) => e.status === s).length;
          return (
            <section key={c.id} className="glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">{steps.length} mensagens · {c.window_start}h–{c.window_end}h · até {c.daily_limit}/dia</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.active ? "Ativa" : "Pausada"}</span>
                  <Switch checked={c.active} onCheckedChange={(v) => toggle(c.id, v)} aria-label="Ativar cadência" />
                  <DisabledReason reason={isAdmin ? null : "Apenas administradores podem excluir cadências."}>
                    <Button size="icon" variant="ghost" className="size-8" disabled={!isAdmin} onClick={() => remove(c.id)} aria-label="Excluir"><Trash2 /></Button>
                  </DisabledReason>
                </div>
              </div>
              <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                {steps.map((s, i) => <li key={i} className="truncate"><b className="text-foreground">{i + 1}.</b> {i === 0 ? (s.wait_hours ? `após ${s.wait_hours} h` : "na hora") : `+${s.wait_hours} h`} — {s.body}</li>)}
              </ol>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["Em andamento", n("active")], ["Concluídos", n("completed")], ["Parados", n("stopped")]].map(([l, v]) => (
                  <div key={l as string} className="rounded-2xl bg-muted/60 p-2"><p className="tabular text-lg font-extrabold">{v}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
                ))}
              </div>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">Parados = responderam, pediram para sair ou falharam<InfoTip>Quem responde vai para a coluna Respondeu do Funil e sai da cadência — assim ninguém recebe follow-up no meio de uma negociação.</InfoTip></p>
              <div className="mt-3 flex gap-2">
                <select className="h-9 flex-1 rounded-xl border bg-background px-3 text-sm" value={pick[c.id] ?? ""} onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })}>
                  <option value="">Escolha uma lista para inscrever…</option>
                  {(lists.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <DisabledReason reason={!c.active ? "Ative a cadência primeiro." : !pick[c.id] ? "Escolha uma lista de contatos ao lado." : null}>
                  <Button size="sm" className="h-9" disabled={!c.active || !pick[c.id] || busy === c.id} onClick={() => enroll(c)}>{busy === c.id ? <Loader2 className="animate-spin" /> : <UserPlus />} Inscrever</Button>
                </DisabledReason>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
