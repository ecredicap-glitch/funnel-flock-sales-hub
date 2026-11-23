import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Building2,
  Calendar,
  ExternalLink,
  Info,
  ListPlus,
  Mail,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  UserCheck,
  Users,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

function formatFieldLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function ContatosPage() {
  const { current, userId, isAdmin } = useWorkspace();
  const ws = current!.workspace.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [tab, setTab] = useState("contatos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

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
    if (error) { toast.error(error.message); return; }
    toast.success(`Contato marcado como ${STATUS_LABEL[status].toLowerCase()}`); refresh();
  }
  async function remove(c: Contact) {
    const { error } = await supabase.from("contacts").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contato excluído"); refresh();
  }
  async function addToList(c: Contact, listId: string) {
    const { error } = await supabase.from("contact_list_members").upsert({ contact_id: c.id, list_id: listId, workspace_id: ws }, { ignoreDuplicates: true });
    if (error) { toast.error(error.message); return; }
    toast.success("Adicionado à lista"); refresh();
  }

  // Ações em massa
  async function deleteSelected() {
    if (!selectedIds.size) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} contato(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase.from("contacts").delete().in("id", chunk).eq("workspace_id", ws);
        if (error) throw error;
      }
      toast.success(`${selectedIds.size} contato(s) excluído(s) com sucesso`);
      setSelectedIds(new Set());
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir contatos.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteAllFiltered(currentFilteredRows: typeof all) {
    if (!currentFilteredRows.length) return;
    const count = currentFilteredRows.length;
    if (!confirm(`ATENÇÃO: Deseja realmente excluir TODOS os ${count} contatos listados? Esta ação é definitiva e removerá os contatos do banco.`)) return;
    setDeleting(true);
    try {
      const ids = currentFilteredRows.map((c) => c.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase.from("contacts").delete().in("id", chunk).eq("workspace_id", ws);
        if (error) throw error;
      }
      toast.success(`${count} contato(s) excluído(s) com sucesso!`);
      setSelectedIds(new Set());
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir contatos.");
    } finally {
      setDeleting(false);
    }
  }

  const toggleSelectAll = (rows: typeof all) => {
    const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      rows.forEach((r) => next.delete(r.id));
    } else {
      rows.forEach((r) => next.add(r.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const table = (rows: typeof all) => rows.length === 0 ? (
    <EmptyState icon={Users} title={all.length ? "Nenhum contato encontrado" : "Sua base está vazia"}
      description={all.length ? "Ajuste a busca ou o filtro." : "Importe uma planilha CSV/XLSX ou adicione um contato manualmente. Só contatos com opt-in entram em campanhas."} />
  ) : (
    <div className="space-y-3">
      {/* Barra de Ações em Massa */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/20 px-4 py-2 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <Checkbox
                checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                onCheckedChange={() => toggleSelectAll(rows)}
              />
              <span>Selecionar página ({rows.slice(0, 500).length})</span>
            </label>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="font-mono">
                {selectedIds.size} selecionado(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 rounded-xl text-xs"
                disabled={deleting}
                onClick={deleteSelected}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Excluir selecionados ({selectedIds.size})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
              disabled={deleting || rows.length === 0}
              onClick={() => deleteAllFiltered(rows)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Excluir todos ({rows.length})
            </Button>
          </div>
        </div>
      )}

      <div className="glass overflow-x-auto rounded-3xl">
        <Table>
          <TableHeader><TableRow>
            {isAdmin && <TableHead className="w-10" />}
            <TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead className="hidden md:table-cell">Tags</TableHead>
            <TableHead className="hidden lg:table-cell">Opt-in</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.slice(0, 500).map((c) => (
              <TableRow key={c.id}>
                {isAdmin && (
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleSelectOne(c.id)}
                    />
                  </TableCell>
                )}
                <TableCell
                  className="font-medium cursor-pointer hover:underline text-primary"
                  onClick={() => setViewingContact(c)}
                >
                  {c.name ?? "—"}
                  <div className="text-xs text-muted-foreground">{c.city}</div>
                </TableCell>
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
                      <DropdownMenuItem onClick={() => setViewingContact(c)}>
                        <Building2 className="mr-2 h-4 w-4" />Ver ficha completa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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

      {/* Ficha Completa do Contato (Drawer Lateral) */}
      <Sheet open={!!viewingContact} onOpenChange={(open) => !open && setViewingContact(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {viewingContact && (
            <div className="space-y-6 pt-4">
              <SheetHeader>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={viewingContact.status === "active" ? "default" : "outline"}>
                    {STATUS_LABEL[viewingContact.status]}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    Funil: {viewingContact.stage}
                  </Badge>
                </div>
                <SheetTitle className="text-xl font-bold mt-2">
                  {viewingContact.name || "Sem nome cadastrado"}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <span className="font-mono">{formatPhone(viewingContact.phone)}</span>
                  <a
                    href={`https://wa.me/${viewingContact.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-primary hover:underline ml-2"
                  >
                    Abrir no WhatsApp <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </SheetDescription>
              </SheetHeader>

              {/* Informações Básicas */}
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2.5 text-sm">
                <h4 className="font-semibold text-xs tracking-wide uppercase text-muted-foreground">Contato Básico</h4>
                {viewingContact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingContact.email}</span>
                  </div>
                )}
                {viewingContact.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingContact.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Cadastrado em {new Date(viewingContact.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Belem" })}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {viewingContact.tags && viewingContact.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Tags & Segmentação
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingContact.tags.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dados da Planilha / Empresa (custom_fields) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Dados da Planilha / Empresa
                  </h4>
                  <span className="text-[11px] text-muted-foreground">Variáveis para campanhas</span>
                </div>

                {viewingContact.custom_fields && Object.keys(viewingContact.custom_fields as object).length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/50 bg-card/60 p-3">
                    {Object.entries(viewingContact.custom_fields as Record<string, unknown>).map(([key, val]) => (
                      <div key={key} className="flex flex-col py-1.5 border-b border-border/30 last:border-b-0">
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatFieldLabel(key)} <code className="text-[10px] text-primary">{"{{" + key + "}}"}</code>
                        </span>
                        <span className="text-sm font-semibold text-foreground break-words mt-0.5">
                          {String(val ?? "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
                    <Info className="h-4 w-4" />
                    Nenhum dado adicional foi gravado para este contato.
                  </div>
                )}
              </div>

              {/* Consentimento & Auditoria LGPD */}
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2 text-xs">
                <h4 className="font-semibold text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Origem & Consentimento (LGPD)
                </h4>
                <p><b>Origem declarada:</b> {viewingContact.opt_in_source || "Não informada"}</p>
                <p>
                  <b>Data do Opt-in:</b>{" "}
                  {viewingContact.opt_in_at
                    ? new Date(viewingContact.opt_in_at).toLocaleString("pt-BR", { timeZone: "America/Belem" })
                    : "Sem registro"}
                </p>
              </div>

              {/* Ações Rápidas */}
              <div className="pt-2 flex flex-wrap gap-2">
                {viewingContact.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      setStatus(viewingContact, "unsubscribed");
                      setViewingContact((prev) => prev ? { ...prev, status: "unsubscribed" } : null);
                    }}
                  >
                    Marcar descadastrado
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      setStatus(viewingContact, "active");
                      setViewingContact((prev) => prev ? { ...prev, status: "active" } : null);
                    }}
                  >
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Reativar contato
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={() => {
                      remove(viewingContact);
                      setViewingContact(null);
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NewContactDialog({ ws, userId, onDone }: { ws: string; userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", city: "", tags: "", source: "" });
  const [optIn, setOptIn] = useState(false);
  async function save() {
    const phone = normalizePhone(f.phone);
    if (!phone) { toast.error("Telefone inválido", { description: "Use DDD + número, ex.: (91) 98888-7777." }); return; }
    const { error } = await supabase.from("contacts").insert({
      workspace_id: ws, phone, name: f.name || null, email: f.email || null, city: f.city || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), created_by: userId,
      opt_in: optIn, opt_in_source: optIn ? f.source : null, opt_in_at: optIn ? new Date().toISOString() : null,
    });
    if (error) { toast.error(error.code === "23505" ? "Esse telefone já está na base" : error.message); return; }
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
    if (error) { toast.error(error.message); return; }
    setName(""); onDone();
  }
  async function del(id: string) {
    const { error } = await supabase.from("contact_lists").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
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
