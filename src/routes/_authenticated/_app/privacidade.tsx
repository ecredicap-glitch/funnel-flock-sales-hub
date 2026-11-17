import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Search,
  Trash2,
  Download,
  AlertOctagon,
  FileText,
  UserX,
  History,
  Lock,
  MessageSquareOff,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { normalizePhone, formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade & LGPD — ZapPilot" },
      { name: "description", content: "Auditoria, direitos do titular e mensagem de descadastro." },
      { property: "og:title", content: "Privacidade & LGPD — ZapPilot" },
      { property: "og:description", content: "Auditoria, direitos do titular e mensagem de descadastro." },
    ],
  }),
  component: PrivacidadePage,
});

type AuditEntry = {
  id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, any>;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  "contact.delete": { label: "Exclusão de contato", tone: "text-destructive" },
  "contact.erase": { label: "Expurgo LGPD (Titular)", tone: "text-destructive font-bold" },
  "contact.status": { label: "Alteração de status", tone: "text-warning" },
  "contact.opt_in": { label: "Atualização de consentimento", tone: "text-primary" },
  "contact.export": { label: "Exportação de dados", tone: "text-primary" },
  "campaign.create": { label: "Criação de campanha", tone: "text-foreground" },
  "campaign.delete": { label: "Exclusão de campanha", tone: "text-destructive" },
  "campaign.status": { label: "Status de campanha", tone: "text-warning" },
  "member.add": { label: "Novo membro", tone: "text-success" },
  "member.remove": { label: "Remoção de membro", tone: "text-destructive" },
  "member.role": { label: "Alteração de perfil", tone: "text-warning" },
  "invite.create": { label: "Envio de convite", tone: "text-primary" },
  "invite.cancel": { label: "Cancelamento de convite", tone: "text-muted-foreground" },
  "cadence.create": { label: "Criação de cadência", tone: "text-foreground" },
  "cadence.active": { label: "Ativação de cadência", tone: "text-success" },
  "credit.add": { label: "Concessão de créditos", tone: "text-primary" },
  "credit.remove": { label: "Estorno de créditos", tone: "text-destructive" },
};

function formatDetails(details: Record<string, any>): string {
  if (!details || Object.keys(details).length === 0) return "—";
  const parts: string[] = [];
  if (details.nome) parts.push(`Nome: ${details.nome}`);
  if (details.telefone) parts.push(`Tel: ${details.telefone}`);
  if (details.de && details.para) parts.push(`De: ${details.de} ➔ Para: ${details.para}`);
  if (details.motivo) parts.push(`Motivo: ${details.motivo}`);
  if (details.email) parts.push(`E-mail: ${details.email}`);
  if (details.quantidade) parts.push(`Quantidade: ${details.quantidade}`);
  if (details.total) parts.push(`Total: ${details.total}`);
  return parts.length > 0 ? parts.join(" · ") : JSON.stringify(details);
}

function PrivacidadePage() {
  const { current, isAdmin } = useWorkspace();
  const wsId = current?.workspace.id ?? "";
  const qc = useQueryClient();

  const [optoutMsg, setOptoutMsg] = useState(
    current?.workspace?.optout_message ||
      "Pronto, você não vai mais receber nossas mensagens. Se precisar de algo, é só chamar por aqui."
  );
  const [optoutSaving, setOptoutSaving] = useState(false);

  // Busca do contato para LGPD
  const [searchPhone, setSearchPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundContact, setFoundContact] = useState<any | null>(null);
  const [eraseDialogOpen, setEraseDialogOpen] = useState(false);
  const [erasing, setErasing] = useState(false);

  // Consulta do Log de Auditoria
  const auditQuery = useQuery({
    queryKey: ["audit_log", wsId],
    enabled: !!wsId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, actor_id, details, created_at")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });

  // Salvar mensagem de opt-out
  async function handleSaveOptout(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin || !wsId) return;
    setOptoutSaving(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ optout_message: optoutMsg.trim() })
        .eq("id", wsId);
      if (error) throw error;
      toast.success("Mensagem de opt-out atualizada com sucesso!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar mensagem.");
    } finally {
      setOptoutSaving(false);
    }
  }

  // Buscar contato por telefone
  async function handleSearchContact(e: FormEvent) {
    e.preventDefault();
    const norm = normalizePhone(searchPhone);
    if (!norm) {
      toast.error("Digite um telefone válido com DDD (ex: 91988887777).");
      return;
    }
    setSearching(true);
    setFoundContact(null);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("phone", norm)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.info("Nenhum contato encontrado com este número.");
      } else {
        setFoundContact(data);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha na busca.");
    } finally {
      setSearching(false);
    }
  }

  // Exportar dados do titular (Portabilidade Art. 18 LGPD)
  async function handleExportContact() {
    if (!foundContact) return;
    try {
      // Registrar ação em auditoria
      await supabase.rpc("log_audit", {
        _ws: wsId,
        _action: "contact.export",
        _entity: foundContact.id,
        _details: { telefone: foundContact.phone, nome: foundContact.name },
      });

      // Baixar mensagens
      const { data: messages } = await supabase
        .from("wa_messages")
        .select("direction, body, created_at")
        .eq("workspace_id", wsId)
        .eq("phone", foundContact.phone)
        .order("created_at");

      const exportBundle = {
        titular: {
          nome: foundContact.name,
          telefone: foundContact.phone,
          cidade: foundContact.city,
          opt_in: foundContact.opt_in,
          origem_consentimento: foundContact.opt_in_source,
          data_consentimento: foundContact.opt_in_at,
          status: foundContact.status,
          campos_personalizados: foundContact.custom_fields,
        },
        historico_mensagens: messages ?? [],
        exportado_em: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados_lgpd_${foundContact.phone}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados e evento registrado na auditoria.");
      qc.invalidateQueries({ queryKey: ["audit_log", wsId] });
    } catch {
      toast.error("Não foi possível exportar os dados.");
    }
  }

  // Expurgo irreversível (Direito ao esquecimento)
  async function handleEraseContact() {
    if (!isAdmin || !foundContact) return;
    setErasing(true);
    try {
      const { error } = await supabase.rpc("erase_contact", {
        _contact_id: foundContact.id,
      });
      if (error) throw error;
      toast.success("Dados do contato completamente anonimizados e apagados.");
      setEraseDialogOpen(false);
      setFoundContact(null);
      setSearchPhone("");
      qc.invalidateQueries({ queryKey: ["audit_log", wsId] });
      qc.invalidateQueries({ queryKey: ["contacts", wsId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao expurgar dados.");
    } finally {
      setErasing(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Conformidade & Governança"
        title="Privacidade & LGPD"
        description="Auditoria detalhada de operações, atendimento aos direitos do titular (Art. 18 LGPD) e controle de opt-out."
      />

      <Tabs defaultValue="auditoria" className="animate-fade-up">
        <TabsList className="h-auto flex-wrap rounded-2xl p-1 mb-4">
          <TabsTrigger value="auditoria" className="rounded-xl">
            <History className="mr-1.5 size-4" /> Log de Auditoria
          </TabsTrigger>
          <TabsTrigger value="titular" className="rounded-xl">
            <UserX className="mr-1.5 size-4" /> Direitos do Titular (LGPD)
          </TabsTrigger>
          <TabsTrigger value="optout" className="rounded-xl">
            <MessageSquareOff className="mr-1.5 size-4" /> Descadastro Automático
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Log de Auditoria */}
        <TabsContent value="auditoria">
          <section className="glass rounded-3xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Trilha de Auditoria Imutável</h3>
                <p className="text-xs text-muted-foreground">
                  Registros cronológicos de todas as ações de importação, disparos, alterações e exclusões na equipe.
                </p>
              </div>
              <Lock className="size-5 text-muted-foreground" />
            </div>

            {auditQuery.data && auditQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Detalhes do Evento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditQuery.data.map((log) => {
                      const act = ACTION_LABELS[log.action] || { label: log.action, tone: "text-foreground" };
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className={cn("text-xs font-semibold whitespace-nowrap", act.tone)}>
                            {act.label}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-lg truncate">
                            {formatDetails(log.details)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum evento registrado ainda. As ações da equipe aparecerão automaticamente aqui.
              </p>
            )}
          </section>
        </TabsContent>

        {/* Aba 2: Direitos do Titular (LGPD) */}
        <TabsContent value="titular">
          <section className="glass rounded-3xl p-6">
            <div className="mb-6 space-y-1">
              <h3 className="font-bold">Atendimento a Solicitações de Titulares</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Localize um titular pelo número de telefone para fornecer portabilidade dos dados ou realizar o expurgo completo em atendimento à Lei Geral de Proteção de Dados (Lei 13.709/2018).
              </p>
            </div>

            <form onSubmit={handleSearchContact} className="flex max-w-md gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 h-11 rounded-xl"
                  placeholder="DDD + Telefone (ex: 91988887777)"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={searching} className="rounded-xl h-11">
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </form>

            {foundContact && (
              <div className="rounded-2xl border bg-muted/20 p-5 space-y-4 max-w-2xl animate-fade-up">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h4 className="font-bold text-base">{foundContact.name || "Contato sem nome"}</h4>
                    <p className="font-mono text-xs text-muted-foreground">+{foundContact.phone}</p>
                  </div>
                  <Badge variant={foundContact.status === "active" ? "default" : "secondary"}>
                    {foundContact.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Consentimento (Opt-in):</span>
                    <p className="font-semibold mt-0.5">{foundContact.opt_in ? "Sim, autorizado" : "Não"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Origem do Opt-in:</span>
                    <p className="font-semibold mt-0.5">{foundContact.opt_in_source || "Manual / Planilha"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cidade / Região:</span>
                    <p className="font-semibold mt-0.5">{foundContact.city || "Não informada"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cadastrado em:</span>
                    <p className="font-semibold mt-0.5">
                      {format(parseISO(foundContact.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={handleExportContact} className="rounded-xl">
                    <Download className="mr-1.5 size-4" /> Exportar Dados (Portabilidade)
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setEraseDialogOpen(true)}
                      className="rounded-xl"
                    >
                      <Trash2 className="mr-1.5 size-4" /> Apagar Dados Definitivamente (LGPD)
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        {/* Aba 3: Descadastro Automático (Opt-out) */}
        <TabsContent value="optout">
          <section className="glass rounded-3xl p-6 max-w-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="font-bold">Mensagem de Confirmação de Opt-Out</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando um cliente responder no WhatsApp palavras como <strong>SAIR</strong>, <strong>PARAR</strong> ou <strong>CANCELAR</strong>, o sistema desativa o envio para este contato e responde automaticamente com este texto.
              </p>
            </div>

            <form onSubmit={handleSaveOptout} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="optout">Texto enviado após o cancelamento</Label>
                <Textarea
                  id="optout"
                  rows={4}
                  value={optoutMsg}
                  onChange={(e) => setOptoutMsg(e.target.value)}
                  maxLength={500}
                  disabled={!isAdmin}
                  className="rounded-2xl"
                />
                <p className="text-xs text-muted-foreground text-right">{optoutMsg.length} / 500 caracteres</p>
              </div>

              {isAdmin ? (
                <Button type="submit" disabled={optoutSaving} className="rounded-xl">
                  {optoutSaving ? "Salvando..." : "Salvar Configuração"}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Apenas administradores podem alterar a mensagem padrão.</p>
              )}
            </form>
          </section>
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação de Expurgo LGPD */}
      <Dialog open={eraseDialogOpen} onOpenChange={setEraseDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertOctagon className="size-5" />
              <DialogTitle>Confirmação de Expurgo LGPD</DialogTitle>
            </div>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong> e atende à requisição legal de esquecimento do titular:
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl bg-destructive/10 p-4 text-xs space-y-2 text-destructive-foreground">
            <p>• O contato será excluído permanentemente da base.</p>
            <p>• Todas as conversas de WhatsApp com este número serão apagadas.</p>
            <p>• O histórico em campanhas será anonimizado.</p>
            <p>• Um registro imutável com número mascarado será gravado na auditoria.</p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setEraseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={erasing}
              onClick={handleEraseContact}
              className="rounded-xl"
            >
              {erasing ? "Apagando..." : "Sim, Excluir Todos os Dados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}