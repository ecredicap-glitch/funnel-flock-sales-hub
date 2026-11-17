import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Users,
  Send,
  CheckCheck,
  MessageCircleReply,
  UserMinus,
  Coins,
  Smartphone,
  BarChart3,
  CalendarClock,
  Upload,
  Megaphone,
  ArrowUpRight,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { profileQuery, useWorkspace } from "@/lib/workspace";
import { whatsappAction } from "@/lib/whatsapp.functions";
import { supabase } from "@/integrations/supabase/client";
import { since } from "@/lib/funnel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { HealthRing } from "@/components/app/HealthRing";
import { calculateChipHealth } from "@/lib/chip-health";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/cockpit")({
  head: () => ({
    meta: [
      { title: "Cockpit — ZapPilot" },
      { name: "description", content: "Visão geral: saúde dos números, envios, respostas e próximas ações." },
      { property: "og:title", content: "Cockpit — ZapPilot" },
      { property: "og:description", content: "Visão geral do relacionamento via WhatsApp." },
    ],
  }),
  component: Cockpit,
});

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Belem" }).format(new Date()),
  );
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const HEATMAP_DAYS = [
  { dow: 1, label: "Seg" },
  { dow: 2, label: "Ter" },
  { dow: 3, label: "Qua" },
  { dow: 4, label: "Qui" },
  { dow: 5, label: "Sex" },
  { dow: 6, label: "Sáb" },
  { dow: 0, label: "Dom" },
];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

type Metrics = {
  contacts: number;
  sent_today: number;
  sent: number;
  contacted: number;
  repliers: number;
  camp_sent: number;
  camp_delivered: number;
  camp_failed: number;
  optouts: number;
  daily: { day: string; sent: number; replies: number }[];
  heatmap: { dow: number; hour: number; n: number }[];
  stages: Record<string, number>;
  daily_limit: number | null;
  scheduled: { name: string; status: string; start_at: string | null; remaining: number }[];
  followups_today: number;
  hot_leads: { id: string; name: string | null; phone: string; stage: string; last_in: string }[];
};

function Cockpit() {
  const { userId, current } = useWorkspace();
  const wsId = current?.workspace.id ?? "";
  const { data: profile } = useQuery(profileQuery(userId));
  const [range, setRange] = useState<7 | 30>(7);
  const firstName = profile?.full_name?.split(" ")[0];

  const fnWa = useServerFn(whatsappAction);
  const waQuery = useQuery({
    queryKey: ["wa", wsId],
    enabled: !!wsId,
    refetchInterval: 25000,
    queryFn: () => fnWa({ data: { workspaceId: wsId, action: "status" } }),
  });

  const metricsQuery = useQuery({
    queryKey: ["workspace_metrics", wsId, range],
    enabled: !!wsId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("workspace_metrics", { _ws: wsId, _days: range });
      if (error) throw error;
      return (data ?? {}) as unknown as Metrics;
    },
  });

  const creditQuery = useQuery({
    queryKey: ["credit_summary", wsId],
    enabled: !!wsId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("credit_summary", { _ws: wsId });
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const metrics = metricsQuery.data;
  const isConnected = waQuery.data?.state === "open";

  // Score de Saúde do Número (0 a 100) unificado com chip-health
  const health = useMemo(() => {
    if (!isConnected) {
      return {
        score: null,
        title: "Nenhum número conectado",
        desc: "Conecte seu WhatsApp para habilitar envios, cadências e monitoramento de saúde.",
      };
    }

    const computed = calculateChipHealth({
      connected: true,
      sentToday: metrics?.sent_today ?? 0,
      failedToday: metrics?.camp_failed ?? 0,
      dailyLimit: metrics?.daily_limit ?? 20,
      optouts: metrics?.optouts ?? 0,
    });

    return {
      score: computed.score,
      title: `Número: ${computed.statusLabel}`,
      desc: computed.reason,
    };
  }, [isConnected, metrics]);

  // Cálculos de KPIs
  const deliveryRate = useMemo(() => {
    if (!metrics?.camp_sent || metrics.camp_sent === 0) return "—";
    const deliv = metrics.camp_delivered ?? 0;
    return `${Math.round((deliv / metrics.camp_sent) * 100)}%`;
  }, [metrics]);

  const replyRate = useMemo(() => {
    if (!metrics?.contacted || metrics.contacted === 0) return "—";
    const rep = metrics.repliers ?? 0;
    return `${Math.round((rep / metrics.contacted) * 100)}%`;
  }, [metrics]);

  const kpis = [
    {
      label: "Contatos",
      value: (metrics?.contacts ?? 0).toLocaleString("pt-BR"),
      hint: "com opt-in válido",
      icon: Users,
    },
    {
      label: "Enviadas hoje",
      value: (metrics?.sent_today ?? 0).toLocaleString("pt-BR"),
      hint: `de ${metrics?.daily_limit || 50} permitidas`,
      icon: Send,
    },
    {
      label: "Taxa de entrega",
      value: deliveryRate,
      hint: `últimos ${range} dias`,
      icon: CheckCheck,
    },
    {
      label: "Taxa de resposta",
      value: replyRate,
      hint: `últimos ${range} dias`,
      icon: MessageCircleReply,
    },
    {
      label: "Descadastros",
      value: (metrics?.optouts ?? 0).toLocaleString("pt-BR"),
      hint: `últimos ${range} dias`,
      icon: UserMinus,
    },
    {
      label: "Saldo disponível",
      value: creditQuery.data?.balance != null ? Number(creditQuery.data.balance).toLocaleString("pt-BR") : "—",
      hint: "créditos de mensagem",
      icon: Coins,
    },
  ];

  // Gráfico de envios x respostas
  const chartData = useMemo(() => {
    if (!metrics?.daily?.length) return [];
    return metrics.daily.map((d) => ({
      label: format(parseISO(d.day), "dd/MM"),
      enviadas: d.sent,
      respostas: d.replies,
    }));
  }, [metrics?.daily]);

  const hasChartData = useMemo(() => chartData.some((d) => d.enviadas > 0 || d.respostas > 0), [chartData]);

  // Heatmap indexado
  const heatmapMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!metrics?.heatmap) return map;
    for (const h of metrics.heatmap) {
      map.set(`${h.dow}-${h.hour}`, h.n);
    }
    return map;
  }, [metrics?.heatmap]);

  const maxHeatmap = useMemo(() => {
    if (!metrics?.heatmap?.length) return 1;
    return Math.max(1, ...metrics.heatmap.map((x) => x.n));
  }, [metrics?.heatmap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 pt-2 animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-ink">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} · {current?.workspace.name}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
      </div>

      {/* Faixa de Saúde do Número */}
      <section className="glass flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center animate-fade-up">
        <div className="flex items-center gap-4">
          <HealthRing value={health.score} size={76} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Saúde do número</p>
              {isConnected && waQuery.data?.number && (
                <span className="font-mono text-xs text-primary">+{waQuery.data.number}</span>
              )}
            </div>
            <p className="mt-0.5 font-bold">{health.title}</p>
            <p className="text-sm text-muted-foreground">{health.desc}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {[
            ["bg-success", "70–100 saudável"],
            ["bg-warning", "40–69 atenção"],
            ["bg-destructive", "0–39 risco"],
          ].map(([c, t]) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", c)} /> {t}
            </span>
          ))}
          <Button asChild variant={isConnected ? "outline" : "hero"} size="sm" className="h-9">
            <Link to="/whatsapp">
              <Smartphone /> {isConnected ? "Gerenciar número" : "Conectar número"}
            </Link>
          </Button>
        </div>
      </section>

      {/* Cards de KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="glass group rounded-3xl p-4 transition-transform duration-300 hover:-translate-y-0.5 animate-fade-up"
            style={{ animationDelay: `${60 + i * 40}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
              <span className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <k.icon className="size-4" />
              </span>
            </div>
            <p className="tabular mt-3 text-3xl font-extrabold tracking-tight">{k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </section>

      {/* Gráficos centrais */}
      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {/* Envios x Respostas */}
        <div className="glass rounded-3xl p-5 animate-fade-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Envios × respostas</h2>
              <p className="text-xs text-muted-foreground">Mensagens enviadas e respondidas por dia</p>
            </div>
            <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
              {([7, 30] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-lg px-3 py-1 transition-colors",
                    range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r} dias
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 min-h-[220px]">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B6F500" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#B6F500" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "1rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="enviadas"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#sentGrad)"
                    name="Enviadas"
                  />
                  <Area
                    type="monotone"
                    dataKey="respostas"
                    stroke="#B6F500"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#replyGrad)"
                    name="Respostas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                compact
                icon={BarChart3}
                title="Sem envios no período"
                description="O gráfico aparece assim que sua primeira campanha começar a rodar."
              />
            )}
          </div>
        </div>

        {/* Heatmap de Melhor Horário */}
        <div className="glass rounded-3xl p-5 animate-fade-up [animation-delay:80ms]">
          <h2 className="font-bold">Melhor horário de resposta</h2>
          <p className="text-xs text-muted-foreground">Calculado a partir das respostas reais (fuso America/Belem)</p>
          <div className="relative mt-4">
            <div className="grid grid-cols-[28px_repeat(12,1fr)] gap-1 text-[10px] text-muted-foreground">
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-center">{h}h</span>
              ))}
              {HEATMAP_DAYS.map((d) => (
                <div key={d.label} className="contents">
                  <span className="self-center font-medium">{d.label}</span>
                  {HOURS.map((h) => {
                    const count = heatmapMap.get(`${d.dow}-${h}`) || 0;
                    const intensity = count > 0 ? Math.max(0.25, count / maxHeatmap) : 0;
                    return (
                      <span
                        key={h}
                        title={count > 0 ? `${count} respostas às ${h}h na ${d.label}` : "Sem respostas"}
                        className={cn(
                          "aspect-square rounded-[5px] transition-colors",
                          count > 0 ? "bg-primary" : "bg-muted/70"
                        )}
                        style={count > 0 ? { opacity: intensity } : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            {maxHeatmap <= 1 && heatmapMap.size === 0 && (
              <div className="absolute inset-0 grid place-items-center">
                <p className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground">
                  Aguardando as primeiras respostas
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Próximas Ações & Leads Quentes */}
      <section className="glass rounded-3xl p-5 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Próximas ações</h2>
            <p className="text-xs text-muted-foreground">
              Campanhas agendadas, follow-ups do dia e leads quentes sem resposta há 24h
            </p>
          </div>
          <CalendarClock className="size-5 text-muted-foreground" />
        </div>

        {metrics?.hot_leads && metrics.hot_leads.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <Flame className="size-4" /> Leads quentes aguardando retorno há mais de 24 horas:
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.hot_leads.map((l) => (
                <div key={l.id} className="flex flex-col justify-between rounded-2xl border bg-muted/30 p-3">
                  <div>
                    <p className="truncate text-sm font-semibold">{l.name || l.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      Estágio: <span className="font-medium capitalize text-foreground">{l.stage}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">há {since(l.last_in)}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                      <Link to="/conversas">Atender</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="size-4" /> Nenhum lead quente atrasado há mais de 24h.
          </div>
        )}

        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guia de Início Rápido</p>
          <ol className="mt-3 grid gap-3 md:grid-cols-3">
            {[
              { n: 1, icon: Smartphone, t: "Conecte um número", d: "Use um número secundário e ative o aquecimento.", to: "/whatsapp" as const },
              { n: 2, icon: Upload, t: "Importe contatos com opt-in", d: "CSV/XLSX com origem e data do consentimento.", to: "/contatos" as const },
              { n: 3, icon: Megaphone, t: "Crie sua primeira campanha", d: "Mensagem com variações e regras anti-banimento.", to: "/campanhas" as const },
            ].map((s) => (
              <li key={s.n}>
                <Link
                  to={s.to}
                  className="group flex h-full gap-3 rounded-2xl border bg-muted/40 p-4 transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-mono text-sm font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      {s.t}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="text-xs text-muted-foreground">{s.d}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}