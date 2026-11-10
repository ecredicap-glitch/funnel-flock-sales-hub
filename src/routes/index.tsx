import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ShieldCheck, Timer, Sparkles, KanbanSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/Logo";
import { HealthRing } from "@/components/app/HealthRing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZapPilot — Disparo e funil de vendas via WhatsApp" },
      {
        name: "description",
        content:
          "Campanhas, cadências e caixa de entrada no WhatsApp com fila anti-banimento, opt-in obrigatório e saúde do número.",
      },
      { property: "og:title", content: "ZapPilot — Disparo e funil de vendas via WhatsApp" },
      {
        property: "og:description",
        content: "Relacionamento em massa com controle: fila anti-banimento, funil e IA.",
      },
    ],
  }),
  component: Landing,
});

const POST_AUTH_KEY = "zappilot-post-auth";

function Landing() {
  const navigate = useNavigate();

  // Social sign-in returns here; once the session exists, continue to the app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      let target = "/cockpit";
      try {
        target = sessionStorage.getItem(POST_AUTH_KEY) || target;
        sessionStorage.removeItem(POST_AUTH_KEY);
      } catch {
        /* storage unavailable */
      }
      navigate({ href: target.startsWith("/") ? target : "/cockpit", replace: true });
    });
  }, [navigate]);

  return (
    <div className="bg-cockpit min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <Button asChild variant="glass" size="sm" className="h-9 px-4">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <section className="space-y-7 animate-fade-up">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Cockpit de relacionamento via WhatsApp
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Escale conversas. <br />
            <span className="text-gradient-signal">Proteja seu número.</span>
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            Campanhas, cadências e funil de vendas com uma fila que respeita limites, horários e
            consentimento — feito para crédito, consórcio e serviços financeiros.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth">
                Começar agora <ArrowRight />
              </Link>
            </Button>
          </div>
          <ul className="grid max-w-lg grid-cols-2 gap-3 pt-2 text-sm text-muted-foreground">
            {[
              { i: Timer, t: "Intervalos aleatórios e aquecimento" },
              { i: ShieldCheck, t: "Opt-in e LGPD de fábrica" },
              { i: Sparkles, t: "Respostas classificadas por IA" },
              { i: KanbanSquare, t: "Funil Kanban com automações" },
            ].map(({ i: I, t }) => (
              <li key={t} className="flex items-center gap-2">
                <I className="size-4 text-primary-ink" /> {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="relative animate-fade-up [animation-delay:150ms]" aria-hidden="true">
          <div className="glass rounded-4xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Saúde do número</p>
                <p className="mt-1 font-mono text-sm">+55 91 9••••-4821</p>
              </div>
              <HealthRing value={86} size={84} />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ["Enviadas", "1.248"],
                ["Entrega", "97,4%"],
                ["Resposta", "18,2%"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted/60 p-3">
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                  <p className="tabular mt-1 text-lg font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex h-28 items-end gap-1.5">
              {[30, 52, 41, 66, 58, 80, 72, 90, 64, 76, 88, 70].map((h, i) => (
                <span
                  key={i}
                  className={i % 3 === 2 ? "flex-1 rounded-md bg-electric/80" : "flex-1 rounded-md bg-primary/80"}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="glass absolute -bottom-6 -left-4 hidden rounded-2xl px-4 py-3 text-sm sm:block animate-float">
            <span className="mr-2 inline-block size-2 rounded-full bg-success" />
            Lead <strong>Interessado</strong> movido para o funil
          </div>
        </section>
      </main>
    </div>
  );
}
