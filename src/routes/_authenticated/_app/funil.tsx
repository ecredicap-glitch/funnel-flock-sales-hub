import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { KanbanSquare, Search, Phone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { formatPhone } from "@/lib/phone";
import { STAGES, PRODUCTS, productLabel, brl, since, type StageId } from "@/lib/funnel";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { InfoTip } from "@/components/app/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/funil")({
  head: () => ({
    meta: [
      { title: "Funil — ZapPilot" },
      { name: "description", content: "Leads em colunas, do primeiro contato ao fechamento." },
      { property: "og:title", content: "Funil — ZapPilot" },
      { property: "og:description", content: "Leads em colunas, do primeiro contato ao fechamento." },
    ],
  }),
  component: FunilPage,
});

type Lead = { id: string; name: string | null; phone: string; stage: string; product: string | null; deal_value: number | null; stage_changed_at: string; last_message_at: string | null; opt_in_source: string | null; status: string };

function FunilPage() {
  const { current } = useWorkspace();
  const ws = current?.workspace.id ?? "";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [prod, setProd] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [edit, setEdit] = useState<Lead | null>(null);
  const key = ["funnel", ws];
  const leads = useQuery({
    queryKey: key, enabled: !!ws, refetchInterval: 20000,
    queryFn: async () => ((await supabase.from("contacts").select("id,name,phone,stage,product,deal_value,stage_changed_at,last_message_at,opt_in_source,status").eq("workspace_id", ws).neq("status", "blocked").order("stage_changed_at", { ascending: false }).limit(2000)).data ?? []) as Lead[],
  });

  const filtered = useMemo(() => (leads.data ?? []).filter((l) =>
    (!prod || l.product === prod) && (!q || `${l.name ?? ""} ${l.phone}`.toLowerCase().includes(q.toLowerCase()))), [leads.data, q, prod]);

  async function move(id: string, stage: StageId) {
    const prev = qc.getQueryData<Lead[]>(key);
    qc.setQueryData<Lead[]>(key, (d) => d?.map((l) => (l.id === id ? { ...l, stage, stage_changed_at: new Date().toISOString() } : l)));
    const { error } = await supabase.from("contacts").update({ stage }).eq("id", id);
    if (error) { qc.setQueryData(key, prev); toast.error("Não foi possível mover o lead."); }
  }
  async function save(l: Lead) {
    const { error } = await supabase.from("contacts").update({ stage: l.stage, product: l.product, deal_value: l.deal_value }).eq("id", l.id);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Lead atualizado."); setEdit(null); qc.invalidateQueries({ queryKey: key });
  }

  const total = (leads.data ?? []).length;

  return (
    <>
      <PageHeader eyebrow="Funil de vendas" title="Funil"
        description={<span className="inline-flex items-center gap-1">Arraste os cards entre as colunas. Os leads andam sozinhos quando recebem mensagem ou respondem.
          <InfoTip>Campanha ou cadência enviada → Contatado. Cliente respondeu → Respondeu (e as cadências dele param). IA detectou interesse → Interessado. As demais colunas você move.</InfoTip></span>} />
      {total === 0 && !leads.isLoading ? (
        <EmptyState icon={KanbanSquare} title="Seu funil está vazio" description="Importe contatos com opt-in. Eles entram na coluna Novo e avançam sozinhos conforme recebem e respondem mensagens.">
          <Button asChild><Link to="/contatos">Importar contatos</Link></Button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={prod} onChange={(e) => setProd(e.target.value)}>
              <option value="">Todos os produtos</option>
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
            {STAGES.map((s) => {
              const items = filtered.filter((l) => l.stage === s.id);
              const sum = items.reduce((a, l) => a + (Number(l.deal_value) || 0), 0);
              return (
                <div key={s.id}
                  onDragOver={(e) => { e.preventDefault(); setOver(s.id); }}
                  onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                  onDrop={() => { if (drag) move(drag, s.id); setDrag(null); setOver(null); }}
                  className={cn("glass flex w-64 shrink-0 flex-col rounded-3xl p-3 transition-colors", over === s.id && "ring-2 ring-primary")}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="flex items-center gap-1 text-sm font-bold">{s.label}<InfoTip>{s.hint}</InfoTip></span>
                    <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular">{items.length}</span>
                  </div>
                  {sum > 0 && <p className="mb-2 px-1 text-xs text-muted-foreground">{brl(sum)} em negociação</p>}
                  <div className="flex max-h-[65vh] min-h-24 flex-col gap-2 overflow-y-auto">
                    {items.slice(0, 200).map((l) => (
                      <button key={l.id} draggable onDragStart={() => setDrag(l.id)} onDragEnd={() => setDrag(null)} onClick={() => setEdit({ ...l })}
                        className={cn("rounded-2xl border bg-card p-3 text-left text-sm transition hover:border-primary/60", drag === l.id && "opacity-50")}>
                        <p className="truncate font-semibold">{l.name ?? "Sem nome"}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{formatPhone(l.phone)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {productLabel(l.product) && <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary-ink">{productLabel(l.product)}</span>}
                          {l.deal_value ? <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{brl(Number(l.deal_value))}</span> : null}
                          {l.status === "unsubscribed" && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">Descadastrado</span>}
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="size-3" />Nesta coluna {since(l.stage_changed_at)}{l.last_message_at ? ` · respondeu ${since(l.last_message_at)}` : ""}</p>
                      </button>
                    ))}
                    {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Arraste um lead para cá</p>}
                    {items.length > 200 && <p className="px-1 text-center text-xs text-muted-foreground">+{items.length - 200} — use a busca</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.name ?? "Lead"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{formatPhone(edit.phone)}{edit.opt_in_source ? ` · origem: ${edit.opt_in_source}` : ""}</p>
              <label className="block text-sm font-medium">Coluna
                <select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm" value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value })}>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Produto
                <select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm" value={edit.product ?? ""} onChange={(e) => setEdit({ ...edit, product: e.target.value || null })}>
                  <option value="">Não definido</option>
                  {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Valor do negócio (R$)
                <Input className="mt-1" type="number" min={0} value={edit.deal_value ?? ""} onChange={(e) => setEdit({ ...edit, deal_value: e.target.value === "" ? null : Number(e.target.value) })} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
                <Button onClick={() => save(edit)}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
