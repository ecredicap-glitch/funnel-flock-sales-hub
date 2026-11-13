import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const BASE = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Chamada única ao AI Gateway (Responses, streaming consumido no servidor) com saída estruturada. */
export async function aiObject<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("IA não configurada.", 401);
  const runId = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: BASE,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runId.fetch,
  });
  let streamErr: unknown = null;
  const result = streamText({
    model: provider.responses(MODEL),
    system,
    prompt,
    maxRetries: 0,
    output: Output.object({ schema }),
    onError: ({ error }) => { streamErr = error; },
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
    },
  });
  try {
    return (await result.output) as T;
  } catch (e) {
    const err: any = streamErr ?? e;
    const status = Number(err?.statusCode ?? err?.status ?? 0);
    console.error("ai gateway error", status, err?.message);
    if (status === 429) throw new AiError("Muitas solicitações à IA. Aguarde alguns segundos e tente de novo.", 429);
    if (status === 402) throw new AiError("Os créditos de IA do workspace acabaram. Adicione créditos para continuar.", 402);
    if (status === 403) throw new AiError("O uso de IA está bloqueado para este workspace.", 403);
    if (NoObjectGeneratedError.isInstance(e)) throw new AiError("A IA não retornou uma resposta válida.", 500);
    throw new AiError("A IA está indisponível no momento.", 500);
  }
}
