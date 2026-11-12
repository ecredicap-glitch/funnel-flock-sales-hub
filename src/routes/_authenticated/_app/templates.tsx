import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { render } from "@/lib/spintax";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/_app/templates")({
  head: () => ({
    meta: [
      { title: "Templates — ZapPilot" },
      { name: "description", content: "Modelos de mensagem com variáveis e variações (spintax)." },
      { property: "og:title", content: "Templates — ZapPilot" },
      { property: "og:description", content: "Modelos de mensagem com variáveis e variações (spintax)." },
    ],
  }),
  component: TemplatesPage,
});

export const CATS: Record<string, string> = { primeiro_contato: "Primeiro contato", follow_up: "Follow-up", proposta: "Proposta", reativacao: "Reativação" };
const READY = [
  ["Crédito – primeiro contato", "primeiro_contato", "{Olá|Oi} {{nome}}, {tudo bem|como vai}? Aqui é da Ecredi. {Estamos ajudando|Temos ajudado} pessoas a encontrar opções de crédito com condições mais adequadas ao seu perfil. Posso te explicar como funciona, sem compromisso?"],
  ["Consórcio – primeiro contato", "primeiro_contato", "{Olá|Oi} {{nome}}! Você já pensou em planejar a compra de um imóvel ou veículo sem juros de financiamento? {Posso|Gostaria de} te mostrar como o consórcio funciona e se faz sentido para você."],
  ["Limpa nome – primeiro contato", "primeiro_contato", "{Olá|Oi} {{nome}}, {tudo bem|como vai}? Trabalhamos com orientação para regularização de pendências no CPF. Cada caso é analisado individualmente. Quer entender as possibilidades para o seu?"],
  ["Rating bancário – primeiro contato", "primeiro_contato", "{Olá|Oi} {{nome}}! Sabia que o seu histórico junto aos bancos influencia as condições de crédito? {Podemos|Posso} fazer uma análise consultiva do seu perfil. Tem interesse?"],
  ["Follow-up gentil", "follow_up", "{Oi|Olá} {{nome}}, {passando para saber|só passando para ver} se conseguiu ver minha mensagem. Fico à disposição para tirar qualquer dúvida."],
  ["Proposta enviada", "proposta", "{{nome}}, preparei uma análise com as opções que encontramos para o seu perfil. {Posso te enviar os detalhes|Quer que eu te explique os detalhes} por aqui?"],
  ["Reativação", "reativacao", "{Olá|Oi} {{nome}}, {faz um tempo que conversamos|conversamos há algum tempo}. Surgiram novas opções que podem fazer sentido para você. Quer que eu verifique?"],
  ["Pós-atendimento", "follow_up", "{Obrigado|Agradeço} pela conversa, {{nome}}! Qualquer dúvida, é só me chamar por aqui. Se não quiser mais receber mensagens, responda SAIR."],
] as const;

function TemplatesPage() {
  const { current } = useWorkspace();
  const ws = current?.workspace.id ?? "";
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["templates", ws], enabled: !!ws,
    queryFn: async () => (await supabase.from("templates").select("*").eq("workspace_id", ws).order("created_at", { ascending: false })).data ?? [],
  });
  const [edit, setEdit] = useState<{ id?: string; name: string; category: string; body: string } | null>(null);
  const [seed, setSeed] = useState(0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["templates", ws] });

  async function save() {
    if (!edit?.name || !edit.body) { toast.error("Preencha nome e mensagem."); return; }
    const row = { name: edit.name, category: edit.category, body: edit.body, workspace_id: ws };
    const { error } = edit.id ? await supabase.from("templates").update(row).eq("id", edit.id) : await supabase.from("templates").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Template salvo."); setEdit(null); refresh();
  }
  async function addReady() {
    const { error } = await supabase.from("templates").insert(READY.map(([name, category, body]) => ({ name, category, body, workspace_id: ws })));
    if (error) toast.error(error.message); else { toast.success("8 modelos adicionados."); refresh(); }
  }
  async function del(id: string) { await supabase.from("templates").delete().eq("id", id); refresh(); }

  return (
    <>
      <PageHeader eyebrow="Biblioteca" title="Templates" description="Use {{nome}} para o nome do contato e {opção 1|opção 2} para variar o texto em cada envio." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setEdit({ name: "", category: "primeiro_contato", body: "" })}><Plus /> Novo template</Button>
        {data.length === 0 && <Button variant="outline" onClick={addReady}><Sparkles /> Adicionar 8 modelos prontos</Button>}
      </div>
      {edit && (
        <section className="glass mb-6 grid gap-4 rounded-3xl p-6 md:grid-cols-2">
          <div className="space-y-3">
            <Input placeholder="Nome do template" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
              {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Textarea rows={7} placeholder="{Olá|Oi} {{nome}}, tudo bem?" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <p className="text-xs text-muted-foreground">Tom consultivo: nunca prometa aprovação garantida.</p>
            <div className="flex gap-2"><Button onClick={save}>Salvar</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Pré-visualização</p><Button size="sm" variant="ghost" onClick={() => setSeed(seed + 1)}><Shuffle /> Outra variação</Button></div>
            <div key={seed} className="max-w-sm whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-primary/15 p-4 text-sm">{render(edit.body || "…", { nome: "Maria" })}</div>
          </div>
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((t) => (
          <article key={t.id} className="glass flex flex-col rounded-3xl p-5">
            <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{CATS[t.category] ?? t.category}</span>
            <h3 className="font-bold">{t.name}</h3>
            <p className="mt-2 line-clamp-4 flex-1 text-sm text-muted-foreground">{t.body}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({ id: t.id, name: t.name, category: t.category, body: t.body })}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => del(t.id)}><Trash2 /></Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
