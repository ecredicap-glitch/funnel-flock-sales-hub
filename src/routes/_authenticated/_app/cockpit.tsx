import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { profileQuery, useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { HealthRing } from "@/components/app/HealthRing";
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

const KPIS = [
  { label: "Contatos", value: "0", hint: "com opt-in válido", icon: Users },
  { label: "Enviadas hoje", value: "0", hint: "de 0 permitidas", icon: Send },
  { label: "Taxa de entrega", value: "—", hint: "últimos 7 dias", icon: CheckCheck },
  { label: "Taxa de resposta", value: "—", hint: "últimos 7 dias", icon: MessageCircleReply },
  { label: "Descadastros", value: "0", hint: "últimos 30 dias", icon: UserMinus },
  { label: "Limite restante", value: "—", hint: "créditos / dia", icon: Coins },
];

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

function Cockpit() {
  const { userId, current } = useWorkspace();
  const { data: profile } = useQuery(profileQuery(userId));
  const [range, setRange] = useState<7 | 30>(7);
  const firstName = profile?.full_name?.split(" ")[0];

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

      {/* Number health strip */}
      <section className="glass flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center animate-fade-up">
        <div className="flex items-center gap-4">
          <HealthRing value={null} size={76} />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Saúde do número</p>
            <p className="mt-0.5 font-bold">Nenhum número conectado</p>
            <p className="text-sm text-muted-foreground">
              O índice 0–100 considera falhas, descadastros, volume vs. limite e idade da conexão.
            </p>
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
          <Button asChild variant="hero" size="sm" className="h-9">
            <Link to="/whatsapp">
              <Smartphone /> Conectar número
            </Link>
          </Button>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k, i) => (
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

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {/* Sends vs replies */}
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
          <EmptyState
            compact
            icon={BarChart3}
            title="Sem envios no período"
            description="O gráfico aparece assim que sua primeira campanha começar a rodar."
          />
        </div>

        {/* Best reply time heatmap */}
        <div className="glass rounded-3xl p-5 animate-fade-up [animation-delay:80ms]">
          <h2 className="font-bold">Melhor horário de resposta</h2>
          <p className="text-xs text-muted-foreground">Calculado a partir das respostas reais (fuso America/Belem)</p>
          <div className="relative mt-4">
            <div className="grid grid-cols-[28px_repeat(12,1fr)] gap-1 text-[10px] text-muted-foreground">
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-center">{h}</span>
              ))}
              {DAYS.map((d) => (
                <div key={d} className="contents">
                  <span className="self-center">{d}</span>
                  {HOURS.map((h) => (
                    <span key={h} className="aspect-square rounded-[5px] bg-muted/70" />
                  ))}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <p className="glass rounded-xl px-3 py-2 text-xs text-muted-foreground">
                Aguardando as primeiras respostas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Next actions */}
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
        <p className="mt-5 text-sm font-semibold">Comece em 3 passos</p>
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
      </section>
    </div>
  );
}
