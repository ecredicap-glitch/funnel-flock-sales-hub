import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Building2,
  KeyRound,
  Loader2,
  UserRound,
  Users,
  UserPlus,
  Trash2,
  Mail,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { profileQuery, ROLE_LABEL, useWorkspace, type MemberRole } from "@/lib/workspace";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ZapPilot" },
      { name: "description", content: "Workspace, perfil, equipe e gateway de WhatsApp." },
      { property: "og:title", content: "Configurações — ZapPilot" },
      { property: "og:description", content: "Workspace, perfil, equipe e gateway de WhatsApp." },
    ],
  }),
  component: SettingsPage,
});

const teamQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["team", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, role, user_id, created_at, profile:profiles(full_name, email, avatar_url)")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Conta" title="Configurações" description="Workspace, perfil, equipe e conexão com o gateway." />
      <Tabs defaultValue="workspace" className="animate-fade-up">
        <TabsList className="h-auto flex-wrap rounded-2xl p-1">
          <TabsTrigger value="workspace" className="rounded-xl"><Building2 className="mr-1.5 size-4" />Workspace</TabsTrigger>
          <TabsTrigger value="perfil" className="rounded-xl"><UserRound className="mr-1.5 size-4" />Perfil</TabsTrigger>
          <TabsTrigger value="equipe" className="rounded-xl"><Users className="mr-1.5 size-4" />Equipe</TabsTrigger>
          <TabsTrigger value="gateway" className="rounded-xl"><KeyRound className="mr-1.5 size-4" />Gateway</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
        <TabsContent value="perfil"><ProfileTab /></TabsContent>
        <TabsContent value="equipe"><TeamTab /></TabsContent>
        <TabsContent value="gateway"><GatewayTab /></TabsContent>
      </Tabs>
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="glass mt-3 max-w-3xl rounded-3xl p-6">{children}</section>;
}

function WorkspaceTab() {
  const { current, isAdmin } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState(current?.workspace.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(current?.workspace.name ?? ""), [current?.workspace.name]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!current || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("workspaces").update({ name: name.trim() }).eq("id", current.workspace.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar."); return; }
    await queryClient.invalidateQueries({ queryKey: ["memberships"] });
    toast.success("Workspace atualizado.");
  }

  return (
    <Panel>
      <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ws-name">Nome do workspace</Label>
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} maxLength={80} className="h-11 rounded-xl" />
          {!isAdmin && <p className="text-xs text-muted-foreground">Apenas administradores podem alterar o nome.</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Fuso horário</Label>
          <Input value={current?.workspace.timezone ?? ""} disabled className="h-11 rounded-xl font-mono" />
          <p className="text-xs text-muted-foreground">Usado na janela de envio e nos relatórios.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Seu papel</Label>
          <Input value={current ? ROLE_LABEL[current.role] : ""} disabled className="h-11 rounded-xl" />
        </div>
        {isAdmin && (
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="animate-spin" />} Salvar alterações
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

function ProfileTab() {
  const { userId } = useWorkspace();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery(userId));
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(profile?.full_name ?? ""), [profile?.full_name]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", userId);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar."); return; }
    await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    toast.success("Perfil atualizado.");
  }

  return (
    <Panel>
      <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full-name">Nome</Label>
          <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input value={profile?.email ?? ""} disabled className="h-11 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="rounded-xl">
            {saving && <Loader2 className="animate-spin" />} Salvar perfil
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function TeamTab() {
  const { current, isAdmin, userId } = useWorkspace();
  const wsId = current?.workspace.id ?? "";
  const queryClient = useQueryClient();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("operator");
  const [sendingInvite, setSendingInvite] = useState(false);

  const { data: team = [], isLoading } = useQuery({ ...teamQuery(wsId), enabled: !!wsId });

  // Consulta de convites pendentes
  const { data: invites = [] } = useQuery({
    queryKey: ["invites", wsId],
    enabled: !!wsId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, email, role, created_at, accepted_at")
        .eq("workspace_id", wsId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function changeRole(memberId: string, role: MemberRole) {
    const { error } = await supabase.from("members").update({ role }).eq("id", memberId);
    if (error) {
      toast.error(error.message.includes("administrador") ? "O workspace precisa de pelo menos um Admin." : "Não foi possível alterar o papel.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["team", wsId] });
    await queryClient.invalidateQueries({ queryKey: ["memberships"] });
    toast.success("Papel atualizado.");
  }

  async function handleSendInvite(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin || !wsId) return;
    const cleanEmail = inviteEmail.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setSendingInvite(true);
    try {
      const { error } = await supabase.from("invites").insert({
        workspace_id: wsId,
        email: cleanEmail,
        role: inviteRole,
        invited_by: userId,
      });
      if (error) {
        if (error.message.includes("duplicate") || error.code === "23505") {
          toast.info("Este e-mail já foi convidado ou já é membro do workspace.");
        } else {
          throw error;
        }
      } else {
        toast.success(`Convite registrado para ${cleanEmail}. Quando ele entrar no sistema, será adicionado à equipe.`);
        setInviteModalOpen(false);
        setInviteEmail("");
        setInviteRole("operator");
        queryClient.invalidateQueries({ queryKey: ["invites", wsId] });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar convite.");
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleCancelInvite(id: string) {
    if (!isAdmin) return;
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao cancelar convite.");
    } else {
      toast.success("Convite cancelado.");
      queryClient.invalidateQueries({ queryKey: ["invites", wsId] });
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Equipe</h2>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Admin</strong> gerencia equipe, créditos e configurações.{" "}
            <strong className="text-foreground">Operador</strong> atende conversas e opera campanhas.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteModalOpen(true)} className="rounded-xl">
            <UserPlus className="mr-1.5 size-4" /> Convidar membro
          </Button>
        )}
      </div>

      {/* Lista de Membros Ativos */}
      <ul className="mt-5 divide-y">
        {isLoading && <li className="py-4 text-sm text-muted-foreground">Carregando…</li>}
        {team.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar className="size-9 border">
              <AvatarImage src={m.profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-electric text-xs font-bold text-electric-foreground">
                {(m.profile?.full_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {m.profile?.full_name ?? "Sem nome"}
                {m.user_id === userId && <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
            </div>
            {isAdmin ? (
              <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as MemberRole)}>
                <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{ROLE_LABEL[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {/* Convites Pendentes */}
      {isAdmin && invites.length > 0 && (
        <div className="mt-8 border-t pt-5">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Convites Pendentes ({invites.length})
          </h3>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{inv.email}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {ROLE_LABEL[inv.role as MemberRole]}
                  </Badge>
                  <span className="text-muted-foreground">
                    enviado em {format(parseISO(inv.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive hover:bg-destructive/10"
                  onClick={() => handleCancelInvite(inv.id)}
                >
                  <Trash2 className="size-3.5 mr-1" /> Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de Convidar Membro */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro para o Workspace</DialogTitle>
            <DialogDescription>
              Informe o e-mail do colaborador e o papel que ele exercerá.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">E-mail do colaborador</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colaborador@empresa.com.br"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Papel na equipe</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                <SelectTrigger id="invite-role" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operador (Atendimento e Campanhas)</SelectItem>
                  <SelectItem value="admin">Administrador (Controle Total)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setInviteModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={sendingInvite} className="rounded-xl">
                {sendingInvite ? "Registrando..." : "Enviar Convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function GatewayTab() {
  const { current } = useWorkspace();
  const instName = current ? `zp-${current.workspace.id.slice(0, 8)}` : "zp-default";

  return (
    <Panel>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h2 className="font-bold text-base">Gateway de Mensageria Evolution API</h2>
            <p className="text-xs text-muted-foreground">Conexão segura para disparo em massa e atendimento via Baileys.</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4 space-y-3 text-xs leading-relaxed">
          <div className="flex items-center gap-2 text-success font-semibold">
            <CheckCircle2 className="size-4" />
            <span>Servidor Conectado & Credenciais Blindadas</span>
          </div>
          <p className="text-muted-foreground">
            A URL do gateway e as chaves de API (<code className="font-mono text-foreground">EVOLUTION_API_KEY</code>) são mantidas exclusivamente no servidor backend (Edge Functions / Secrets). Nenhuma credencial é exposta no navegador dos operadores.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t font-mono text-[11px]">
            <div>
              <span className="text-muted-foreground">Identificador da Instância:</span>
              <p className="font-bold text-foreground mt-0.5">{instName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fila Anti-Banimento:</span>
              <p className="font-bold text-primary mt-0.5">Ativa (Minuto a Minuto)</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Para parear o chip de WhatsApp via QR Code ou verificar a conexão em tempo real:
          </p>
          <Button asChild className="rounded-xl">
            <Link to="/whatsapp">
              <Smartphone className="mr-1.5 size-4" /> Conectar WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}