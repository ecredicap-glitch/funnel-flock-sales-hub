import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Coins,
  Plus,
  TrendingUp,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Check,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Zap,
  Building,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/planos")({
  head: () => ({
    meta: [
      { title: "Planos e créditos — ZapPilot" },
      { name: "description", content: "Saldo de mensagens, consumo, extrato e pacotes disponíveis." },
      { property: "og:title", content: "Planos e créditos — ZapPilot" },
      { property: "og:description", content: "Saldo de mensagens, consumo, extrato e pacotes disponíveis." },
    ],
  }),
  component: PlanosPage,
});

type CreditSummary = {
  granted: number;
  used: number;
  balance: number;
  next_expiry: string | null;
  used_30d: number;
  cadence_30d: number;
};

type CreditGrant = {
  id: string;
  amount: number;
  note: string | null;
  expires_at: string | null;
  created_at: string;
};

const PLANS = [
  {
    id: "start",
    name: "Start",
    badge: "Iniciante",
    price: "R$ 297",
    period: "/mês",
    desc: "Ideal para consultores individuais ou correspondentes bancários iniciando no digital.",
    credits: "2.000 mensagens/mês",
    features: [
      "1 número de WhatsApp conectado",
      "Motor anti-banimento com intervalos aleatórios",
      "Funil de vendas Kanban (arrastar e soltar)",
      "Importação e validação de opt-in (LGPD)",
      "Editor de mensagens com Spintax",
      "Suporte via e-mail e WhatsApp",
    ],
    highlight: false,
    cta: "Contratar Start",
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Mais Popular",
    price: "R$ 597",
    period: "/mês",
    desc: "Para operações financeiras que precisam de escala, cadências e inteligência artificial.",
    credits: "8.000 mensagens/mês",
    features: [
      "Até 3 números com rotação e contingência",
      "Classificação de intenções por IA em tempo real",
      "Avanço automático no Funil ao responder",
      "Cadências automáticas de follow-up",
      "Heatmap de melhor horário de resposta",
      "Suporte prioritário via WhatsApp",
    ],
    highlight: true,
    cta: "Contratar Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: "Escala & Alta Performance",
    price: "R$ 1.497",
    period: "/mês",
    desc: "Para intermediadoras e promotoras com equipe de vendas e múltiplos consultores.",
    credits: "25.000 mensagens/mês",
    features: [
      "Múltiplos números ilimitados",
      "SDR com IA calibrado para produtos financeiros",
      "Múltiplos operadores e controle de permissões",
      "Trilhas consultivas para crédito, consignado e rating",
      "Consultoria de aquecimento de chips (warm-up)",
      "Gerente de conta exclusivo e SLA de 2 horas",
    ],
    highlight: false,
    cta: "Falar com Vendas",
  },
];

function PlanosPage() {
  const { current, isAdmin, userId } = useWorkspace();
  const wsId = current?.workspace.id ?? "";
  const qc = useQueryClient();

  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [checkoutModalPlan, setCheckoutModalPlan] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState<number>(1000);
  const [grantNote, setGrantNote] = useState("");
  const [grantSaving, setGrantSaving] = useState(false);

  // Consulta do saldo e métricas de consumo
  const summaryQuery = useQuery({
    queryKey: ["credit_summary", wsId],
    enabled: !!wsId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("credit_summary", { _ws: wsId });
      if (error) throw error;
      return (data ?? {}) as unknown as CreditSummary;
    },
  });

  // Consulta do extrato de concessões de créditos
  const grantsQuery = useQuery({
    queryKey: ["credit_grants", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_grants")
        .select("id, amount, note, expires_at, created_at")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CreditGrant[];
    },
  });

  const summary = summaryQuery.data;
  const balance = summary?.balance ?? 0;
  const granted = summary?.granted ?? 0;
  const used = summary?.used ?? 0;
  const usedPercent = granted > 0 ? Math.min(100, Math.round((used / granted) * 100)) : 0;
  const isLowBalance = granted > 0 && balance / granted < 0.2;

  async function handleGrantSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin || !wsId || grantAmount <= 0) return;
    setGrantSaving(true);
    try {
      const { error } = await supabase.from("credit_grants").insert({
        workspace_id: wsId,
        amount: grantAmount,
        note: grantNote.trim() || "Créditos concedidos manualmente",
        created_by: userId,
      });
      if (error) throw error;
      toast.success(`${grantAmount.toLocaleString("pt-BR")} créditos adicionados com sucesso!`);
      setGrantModalOpen(false);
      setGrantAmount(1000);
      setGrantNote("");
      qc.invalidateQueries({ queryKey: ["credit_summary", wsId] });
      qc.invalidateQueries({ queryKey: ["credit_grants", wsId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível conceder créditos.");
    } finally {
      setGrantSaving(false);
    }
  }

  async function handleDeleteGrant(id: string) {
    if (!isAdmin || !confirm("Deseja estornar este lançamento de créditos?")) return;
    const { error } = await supabase.from("credit_grants").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover créditos.");
    } else {
      toast.success("Lançamento estornado.");
      qc.invalidateQueries({ queryKey: ["credit_summary", wsId] });
      qc.invalidateQueries({ queryKey: ["credit_grants", wsId] });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Conta & Consumo"
        title="Planos e créditos"
        description="Saldo de mensagens, histórico de consumo em campanhas e pacotes para expansão da sua operação."
      />

      {/* Painel do Saldo Atual */}
      <section className="glass mb-8 rounded-3xl p-6 animate-fade-up">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Coins className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saldo Disponível</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-extrabold tracking-tight">
                    {balance.toLocaleString("pt-BR")}
                  </h2>
                  <span className="text-sm font-medium text-muted-foreground">mensagens</span>
                </div>
              </div>
            </div>
            {isLowBalance && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="size-3.5" />
                Saldo baixo! Restam menos de 20% dos créditos contratados.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
            <div className="rounded-2xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Concedido</p>
              <p className="text-lg font-bold">{granted.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Consumido</p>
              <p className="text-lg font-bold">{used.toLocaleString("pt-BR")}</p>
            </div>
            <div className="col-span-2 rounded-2xl border bg-muted/30 p-3 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Consumo (30 dias)</p>
              <p className="text-lg font-bold">{(summary?.used_30d ?? 0).toLocaleString("pt-BR")}</p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setGrantModalOpen(true)} className="rounded-xl">
                <Plus className="mr-1 size-4" /> Conceder créditos
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uso da cota: {usedPercent}%</span>
            <span>{used.toLocaleString("pt-BR")} de {granted.toLocaleString("pt-BR")} disparos</span>
          </div>
          <Progress value={usedPercent} className="h-2 rounded-full" />
        </div>
      </section>

      {/* Grade de Planos Comerciais */}
      <section className="mb-10 space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pacotes e Planos de Assinatura</h2>
          <p className="text-sm text-muted-foreground">
            Escolha o volume ideal para o tamanho da sua equipe e acelere a conversão de leads.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "glass flex flex-col justify-between rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1",
                plan.highlight ? "border-primary/80 ring-2 ring-primary/40 shadow-lg shadow-primary/10" : ""
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{plan.name}</span>
                  <Badge variant={plan.highlight ? "default" : "outline"} className="rounded-full text-xs">
                    {plan.badge}
                  </Badge>
                </div>
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-extrabold tracking-tight">{plan.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{plan.desc}</p>

                <div className="mt-4 rounded-xl bg-primary/10 p-2.5 text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="size-4 shrink-0" />
                  <span>{plan.credits}</span>
                </div>

                <ul className="mt-6 space-y-2.5 text-xs">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="size-4 shrink-0 text-primary mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t">
                <Button
                  variant={plan.highlight ? "hero" : "outline"}
                  className="w-full rounded-xl"
                  onClick={() => setCheckoutModalPlan(plan.name)}
                >
                  {plan.cta} <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Extrato / Histórico de Lançamentos */}
      <section className="glass rounded-3xl p-6 animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Extrato de Concessões</h3>
            <p className="text-xs text-muted-foreground">Histórico de recargas e bônus aplicados a este workspace.</p>
          </div>
          <Coins className="size-5 text-muted-foreground" />
        </div>

        {grantsQuery.data && grantsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Descrição / Motivo</TableHead>
                  <TableHead>Validade</TableHead>
                  {isAdmin && <TableHead className="text-right">Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grantsQuery.data.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs">
                      {format(parseISO(g.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      +{g.amount.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.note || "Concessão manual"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.expires_at ? format(parseISO(g.expires_at), "dd/MM/yyyy") : "Sem expiração"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteGrant(g.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma concessão de crédito registrada ainda. Clique em "Conceder créditos" para abastecer o saldo.
          </p>
        )}
      </section>

      {/* Dialog para Conceder Créditos */}
      <Dialog open={grantModalOpen} onOpenChange={setGrantModalOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Conceder Créditos</DialogTitle>
            <DialogDescription>
              Adicione créditos de disparo ao saldo deste workspace. Ação registrada em auditoria.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGrantSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Quantidade de mensagens</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                max={1000000}
                value={grantAmount}
                onChange={(e) => setGrantAmount(Number(e.target.value))}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Motivo ou Nota Fiscal / Contrato</Label>
              <Input
                id="note"
                placeholder="Ex.: Pacote Pro - NF 1042 ou Teste Comercial"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                maxLength={200}
                className="h-11 rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setGrantModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={grantSaving || grantAmount <= 0} className="rounded-xl">
                {grantSaving ? "Concedendo..." : "Confirmar Concessão"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Comercial de Upgrade */}
      <Dialog open={!!checkoutModalPlan} onOpenChange={() => setCheckoutModalPlan(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Assinatura {checkoutModalPlan}</DialogTitle>
            <DialogDescription>
              Solicitação de ativação do plano <strong>{checkoutModalPlan}</strong> para este workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>
              Para ativar este plano ou efetuar o pagamento via PIX/Boleto com nota fiscal corporativa, clique abaixo para falar diretamente com nosso especialista.
            </p>
            <div className="rounded-2xl border bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground">Benefício Imediato:</p>
              <p>• Liberação instantânea de créditos após confirmação.</p>
              <p>• Suporte na configuração do seu chip secundário e aquecimento.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full rounded-xl"
              onClick={() => {
                toast.success("Solicitação enviada com sucesso! Nosso consultor entrará em contato.");
                setCheckoutModalPlan(null);
              }}
            >
              Confirmar Interesse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}