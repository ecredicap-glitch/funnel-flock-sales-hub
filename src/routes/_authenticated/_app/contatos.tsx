import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, ListPlus, MoreHorizontal, Plus, Search, Trash2, UserCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useWorkspace } from "@/lib/workspace";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ImportContactsDialog } from "@/components/app/ImportContactsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/_app/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos e listas — ZapPilot" },
      { name: "description", content: "Importe, organize e segmente contatos com consentimento (opt-in)." },
      { property: "og:title", content: "Contatos e listas — ZapPilot" },
      { property: "og:description", content: "Importe, organize e segmente contatos com consentimento (opt-in)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContatosPage,
});

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Status = Database["public"]["Enums"]["contact_status"];
const STATUS_LABEL: Record<Status, string> = { active: "Ativo", unsubscribed: "Descadastrado", blocked: "Bloqueado" };
const SUGGESTED_TAGS = ["crédito consignado", "FGTS", "consórcio", "limpa nome", "rating bancário"];

function ContatosPage() {
  const { current, userId, isAdmin } = useWorkspace();
  const ws = current!.workspace.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [tab, setTab] = useState("contatos");

  const contacts = useQuery({
    queryKey: ["contacts", ws],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, contact_list_members(list_id)")
        .eq("workspace_id", ws).order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return data;
    },
  });
  const lists = useQuery({
    queryKey: ["contact_lists", ws],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_lists").select("*, contact_list_members(count)")
        .eq("workspace_id", ws).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["contacts", ws] }); qc.invalidateQueries({ queryKey: ["contact_lists", ws] }); };

  const all = contacts.data ?? [];
  const term = q.toLowerCase();
  const match = (c: (typeof all)[number]) =>
    (!term || [c.name, c.phone, c.email, c.city, ...c.tags].some((v) => v?.toLowerCase().includes(term))) &&
    (!listFilter || c.contact_list_members.some((m) => m.list_id === listFilter));
  const active = all.filter((c) => c.status === "active" && match(c));
  const blocked = all.filter((c) => c.status !== "active" && match(c));

  async function setStatus(c: Contact, status: Status) {
    const { error } = await supabase.from("contacts").update({ status, status_reason: status === "active" ? null : "Manual" }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(`Contato marcado como ${STATUS_LABEL[status].toLowerCase()}`); refresh();
  }
  async function remove(c: Contact) {
    const { error } = await supabase.from("contacts").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Contato excluído"); refresh();
  }
  async function addToList(c: Contact, listId: string) {
    const { error } = await supabase.from("contact_list_members").upsert({ contact_id: c.id, list_id: listId, workspace_id: ws }, { ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success("Adicionado à lista"); refresh();
  }

  const table = (rows: typeof all) => rows.length === 0 ? (
    <EmptyState icon={Users} title={all.length ? "Nenhum contato encontrado" : "Sua base está vazia"}
      description={all.length ? "Ajuste a busca ou o filtro." : "Importe uma planilha CSV/XLSX ou adicione um contato manualmente. Só contatos com opt-in entram em campanhas."} />
  ) : (
    <div className="glass overflow-x-auto rounded-3xl">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead className="hidden md:table-cell">Tags</TableHead>
          <TableHead className="hidden lg:table-cell">Opt-in</TableHead><TableHead>Status</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {rows.slice(0, 500).map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name ?? "—"}<div className="text-xs text-muted-foreground">{c.city}</div></TableCell>
              <TableCell className="font-mono text-xs">{formatPhone(c.phone)}</TableCell>
              <TableCell className="hidden md:table-cell"><div className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div></TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                {c.opt_in ? <>{c.opt_in_source}<br />{c.opt_in_at && new Date(c.opt_in_at).toLocaleDateString("pt-BR", { timeZone: "America/Belem" })}</> : <span className="text-destructive">Sem opt-in</span>}
              </TableCell>
              <TableCell><Badge variant={c.status === "active" ? "default" : "outline"}>{STATUS_LABEL[c.status]}</Badge></TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(lists.data ?? []).length > 0 && <DropdownMenuLabel>Adicionar à lista</DropdownMenuLabel>}
                    {(lists.data ?? []).map((l) => <DropdownMenuItem key={l.id} onClick={() => addToList(c, l.id)}><ListPlus className="mr-2 h-4 w-4" />{l.name}</DropdownMenuItem>)}
                    <DropdownMenuSeparator />
                    {c.status === "active" ? <>
                      <DropdownMenuItem onClick={() => setStatus(c, "unsubscribed")}>Marcar descadastrado</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(c, "blocked")}><Ban className="mr-2 h-4 w-4" />Bloquear</DropdownMenuItem>
                    </> : <DropdownMenuItem onClick={() => setStatus(c, "active")}><UserCheck className="mr-2 h-4 w-4" />Reativar</DropdownMenuItem>}
                    {isAdmin && <DropdownMenuItem className="text-destructive" onClick={() => remove(c)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 500 && <p className="p-3 text-center text-xs text-muted-foreground">Mostrando 500 de {rows.length}. Use a busca para refinar.</p>}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Base de contatos" title="Contatos e listas"
        description={`${all.filter((c) => c.status === "active").length} ativos · ${all.filter((c) => c.status !== "active").length} bloqueados ou descadastrados`}
        actions={<>
          <NewContactDialog ws={ws} userId={userId} onDone={refresh} />
          <ImportContactsDialog workspaceId={ws} userId={userId} lists={lists.data ?? []} onDone={refresh} />
        </>} />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
            <TabsTrigger value="listas">Listas</TabsTrigger>
            <TabsTrigger value="bloqueados">Bloqueados</TabsTrigger>
          </TabsList>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar nome, telefone, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {listFilter && (
          <div className="mb-3 flex items-center gap-2 text-sm">Filtrando pela lista <b>{lists.data?.find((l) => l.id === listFilter)?.name}</b>
            <Button size="sm" variant="ghost" onClick={() => setListFilter(null)}>Limpar</Button></div>
        )}
        <TabsContent value="contatos">{contacts.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : table(active)}</TabsContent>
        <TabsContent value="bloqueados">{table(blocked)}</TabsContent>
        <TabsContent value="listas"><ListsPanel ws={ws} lists={lists.data ?? []} onDone={refresh} onOpen={(id) => { setListFilter(id); setTab("contatos"); }} /></TabsContent>
      </Tabs>
    </div>
  );
}

function NewContactDialog({ ws, userId, onDone }: { ws: string; userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", city: "", tags: "", source: "" });
  const [optIn, setOptIn] = useState(false);
  async function save() {
    const phone = normalizePhone(f.phone);
    if (!phone) return toast.error("Telefone inválido", { description: "Use DDD + número, ex.: (91) 98888-7777." });
    const { error } = await supabase.from("contacts").insert({
      workspace_id: ws, phone, name: f.name || null, email: f.email || null, city: f.city || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), created_by: userId,
      opt_in: optIn, opt_in_source: optIn ? f.source : null, opt_in_at: optIn ? new Date().toISOString() : null,
    });
    if (error) return toast.error(error.code === "23505" ? "Esse telefone já está na base" : error.message);
    toast.success("Contato adicionado"); setOpen(false); setF({ name: "", phone: "", email: "", city: "", tags: "", source: "" }); setOptIn(false); onDone();
  }
  const field = (k: keyof typeof f, label: string, ph?: string) => (
    <div className="space-y-1"><Label>{label}</Label><Input placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Novo contato</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("name", "Nome")}{field("phone", "Telefone *", "(91) 98888-7777")}
          {field("email", "E-mail")}{field("city", "Cidade")}
        </div>
        {field("tags", "Tags", SUGGESTED_TAGS.slice(0, 3).join(", "))}
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={optIn} onCheckedChange={(v) => setOptIn(v === true)} />O contato autorizou receber mensagens (opt-in)</label>
        {optIn && field("source", "Origem do consentimento", "Ex.: atendimento presencial")}
        <DialogFooter><Button onClick={save} disabled={!f.phone || (optIn && !f.source)}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListsPanel({ ws, lists, onDone, onOpen }: {
  ws: string; lists: { id: string; name: string; description: string | null; contact_list_members: { count: number }[] }[];
  onDone: () => void; onOpen: (id: string) => void;
}) {
  const [name, setName] = useState("");
  async function create() {
    const { error } = await supabase.from("contact_lists").insert({ workspace_id: ws, name: name.trim() });
    if (error) return toast.error(error.message);
    setName(""); onDone();
  }
  async function del(id: string) {
    const { error } = await supabase.from("contact_lists").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onDone();
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:max-w-md">
        <Input placeholder="Nome da nova lista (ex.: Leads FGTS)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={create} disabled={!name.trim()}>Criar</Button>
      </div>
      {lists.length === 0 ? <EmptyState icon={ListPlus} title="Nenhuma lista" description="Crie listas para segmentar campanhas por produto ou origem." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <div key={l.id} className="glass flex items-center justify-between rounded-3xl p-4">
              <button className="text-left" onClick={() => onOpen(l.id)}>
                <p className="font-semibold">{l.name}</p>
                <p className="text-xs text-muted-foreground">{l.contact_list_members[0]?.count ?? 0} contatos · ver na aba Contatos</p>
              </button>
              <Button size="icon" variant="ghost" aria-label="Excluir lista" onClick={() => del(l.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
