import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Gauge, Clock } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/app/Logo";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — ZapPilot" },
      { name: "description", content: "Acesse seu cockpit de relacionamento via WhatsApp." },
      { property: "og:title", content: "Entrar — ZapPilot" },
      { property: "og:description", content: "Acesse seu cockpit de relacionamento via WhatsApp." },
    ],
  }),
  component: AuthPage,
});

/** Only same-origin relative paths are allowed as post-login destinations. */
function safeRedirect(value: string | undefined) {
  if (!value) return "/cockpit";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/cockpit";
    const path = url.pathname + url.search;
    return path === "/" || path.startsWith("/auth") ? "/cockpit" : path;
  } catch {
    return "/cockpit";
  }
}

const REDIRECT_KEY = "zappilot-post-auth";

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: safeRedirect(search.redirect), replace: true });
    });
  }, [navigate, search.redirect]);

  const goAfterLogin = () => navigate({ href: safeRedirect(search.redirect), replace: true });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goAfterLogin();
      } else if (mode === "signup") {
        const fullName = String(form.get("full_name") ?? "").trim();
        const workspaceName = String(form.get("workspace_name") ?? "").trim();
        if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, workspace_name: workspaceName },
          },
        });
        if (error) throw error;
        if (data.session) goAfterLogin();
        else setSent(email);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(email);
      }
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    try {
      sessionStorage.setItem(REDIRECT_KEY, safeRedirect(search.redirect));
    } catch {
      /* storage unavailable */
    }
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    goAfterLogin();
  }

  return (
    <div className="bg-cockpit grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r p-12 lg:flex">
        <Link to="/">
          <Logo />
        </Link>
        <div className="max-w-md space-y-8 animate-fade-up">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Relacionamento em massa, <span className="text-gradient-signal">sem perder o controle.</span>
          </h1>
          <ul className="space-y-4 text-sm text-muted-foreground">
            {[
              { icon: Gauge, t: "Saúde do número monitorada em tempo real" },
              { icon: Clock, t: "Fila com intervalos aleatórios e janela de horário" },
              { icon: ShieldCheck, t: "Opt-in obrigatório e descadastro automático (LGPD)" },
            ].map(({ icon: I, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="glass grid size-9 place-items-center rounded-xl text-primary-ink">
                  <I className="size-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ZapPilot</p>
      </aside>

      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="glass w-full max-w-md rounded-3xl p-6 sm:p-8 animate-fade-up">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>

          {sent ? (
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-bold tracking-tight">Confira seu e-mail</h2>
              <p className="text-sm text-muted-foreground">
                {mode === "forgot"
                  ? "Enviamos um link para redefinir sua senha para "
                  : "Enviamos um link de confirmação para "}
                <strong className="text-foreground">{sent}</strong>.
              </p>
              <Button variant="outline" className="w-full" onClick={() => { setSent(null); setMode("signin"); }}>
                Voltar para o login
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight">
                {mode === "signin" ? "Bem-vindo de volta" : mode === "signup" ? "Crie sua conta" : "Recuperar senha"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "forgot"
                  ? "Informe seu e-mail e enviaremos um link de redefinição."
                  : "Entre no seu cockpit de relacionamento."}
              </p>

              {mode !== "forgot" && (
                <>
                  <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-6">
                    <TabsList className="grid w-full grid-cols-2 rounded-xl">
                      <TabsTrigger value="signin" className="rounded-lg">Entrar</TabsTrigger>
                      <TabsTrigger value="signup" className="rounded-lg">Criar conta</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="mt-5 space-y-2.5">
                    <button type="button" className="google-btn" onClick={() => oauth("google")}>
                      <GoogleG />
                      Continuar com Google
                    </button>
                    <button
                      type="button"
                      className="lovable-auth-button"
                      style={{ width: "100%" }}
                      onClick={() => oauth("lovable")}
                    >
                      Continue with Lovable
                    </button>
                  </div>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className={mode === "forgot" ? "mt-6 space-y-4" : "space-y-4"}>
                {mode === "signup" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="full_name" label="Seu nome" required autoComplete="name" />
                    <Field id="workspace_name" label="Empresa" placeholder="Ex.: Prime Crédito" />
                  </div>
                )}
                <Field id="email" label="E-mail" type="email" required autoComplete="email" />
                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>
                      {mode === "signin" && (
                        <button type="button" className="text-xs text-primary-ink hover:underline" onClick={() => setMode("forgot")}>
                          Esqueci a senha
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}
                <Button type="submit" variant="hero" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
                </Button>
                {mode === "forgot" && (
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("signin")}>
                    Voltar
                  </Button>
                )}
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} className="h-11 rounded-xl" {...props} />
    </div>
  );
}

function translateAuthError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Faça login.";
  if (/password/i.test(msg) && /weak|pwned|leaked/i.test(msg))
    return "Senha fraca ou já vazada. Escolha outra.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  return msg;
}

function GoogleG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}
