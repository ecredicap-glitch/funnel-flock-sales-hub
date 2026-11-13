import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const INTENTS = ["interessado", "duvida", "objecao", "sem_interesse", "descadastro", "outros"] as const;
export type Intent = (typeof INTENTS)[number];

const classifyOut = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number(),
  summary: z.string(),
  next_action: z.string(),
  suggested_reply: z.string(),
});
export type Classification = z.infer<typeof classifyOut>;

const RULES = "Você trabalha para uma intermediadora financeira (crédito, consórcio, limpa nome, rating bancário). Tom consultivo e respeitoso em português do Brasil. NUNCA prometa aprovação garantida, taxas garantidas ou resultados certos.";

async function assertMember(supabase: any, workspaceId: string) {
  const { data } = await supabase.rpc("is_workspace_member", { _workspace_id: workspaceId });
  if (!data) throw new Error("Forbidden");
}

export const classifyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid(), message: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ result: Classification | null; error?: string }> => {
    await assertMember(context.supabase, data.workspaceId);
    const { aiObject, AiError } = await import("./ai/gateway.server");
    try {
      const r = await aiObject(classifyOut,
        `${RULES}\nClassifique a mensagem recebida de um cliente. intent: interessado | duvida | objecao | sem_interesse | descadastro (pediu para parar/sair) | outros. confidence entre 0 e 1. summary: 1 frase. next_action: próxima ação comercial objetiva para o vendedor (1-2 frases). suggested_reply: resposta curta pronta para enviar no WhatsApp; se for descadastro, apenas confirme a remoção com educação.`,
        `Mensagem do cliente:\n"""${data.message}"""`);
      return { result: { ...r, confidence: Math.max(0, Math.min(1, r.confidence)) } };
    } catch (e) {
      return { result: null, error: e instanceof AiError ? e.message : "Falha ao classificar." };
    }
  });

const varsOut = z.object({ variations: z.array(z.object({ title: z.string(), body: z.string() })) });

export const generateVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    workspaceId: z.string().uuid(),
    objective: z.string().trim().min(3).max(1000),
    audience: z.string().trim().min(3).max(1500),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ variations: { title: string; body: string }[]; error?: string }> => {
    await assertMember(context.supabase, data.workspaceId);
    const { aiObject, AiError } = await import("./ai/gateway.server");
    try {
      const r = await aiObject(varsOut,
        `${RULES}\nVocê escreve mensagens de WhatsApp para contatos que deram consentimento (opt-in). Gere exatamente 3 variações diferentes de abordagem. Cada body: até 450 caracteres, use {{nome}} para o primeiro nome (e {{cidade}} só se fizer sentido), inclua spintax no formato {opção A|opção B} em 2 a 4 pontos para variar o texto, termine com uma pergunta aberta e sem links. Não use emojis em excesso (no máximo 1). title: rótulo curto do estilo da abordagem.`,
        `Objetivo da campanha:\n${data.objective}\n\nContexto do público (que consentiu em receber mensagens):\n${data.audience}`);
      return { variations: r.variations.slice(0, 3) };
    } catch (e) {
      return { variations: [], error: e instanceof AiError ? e.message : "Falha ao gerar variações." };
    }
  });
