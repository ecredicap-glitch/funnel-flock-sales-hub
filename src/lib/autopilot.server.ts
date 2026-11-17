import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiObject } from "@/lib/ai/gateway.server";

export type AutopilotConfig = {
  enabled: boolean;
  instruction?: string;
};

const DEFAULT_INSTRUCTION =
  "Você é o assistente virtual de vendas pelo WhatsApp. Tom consultivo, gentil e educado em português do Brasil. Responda dúvidas de forma concisa e natural. NUNCA prometa aprovação garantida de crédito. Termine com uma pergunta aberta para avançar a conversa.";

export async function getAutopilotConfig(workspaceId: string): Promise<AutopilotConfig> {
  const { data } = await supabaseAdmin
    .from("templates")
    .select("body")
    .eq("workspace_id", workspaceId)
    .eq("category", "autopilot")
    .eq("name", "config_autopilot")
    .maybeSingle();

  if (!data?.body) {
    return { enabled: false, instruction: DEFAULT_INSTRUCTION };
  }

  try {
    const parsed = JSON.parse(data.body);
    return {
      enabled: Boolean(parsed.enabled),
      instruction: parsed.instruction || DEFAULT_INSTRUCTION,
    };
  } catch {
    return { enabled: false, instruction: DEFAULT_INSTRUCTION };
  }
}

export async function saveAutopilotConfig(
  workspaceId: string,
  config: { enabled: boolean; instruction?: string }
): Promise<void> {
  const payload = JSON.stringify({
    enabled: config.enabled,
    instruction: config.instruction || DEFAULT_INSTRUCTION,
    updated_at: new Date().toISOString(),
  });

  const { data: existing } = await supabaseAdmin
    .from("templates")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("category", "autopilot")
    .eq("name", "config_autopilot")
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("templates")
      .update({ body: payload })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("templates").insert({
      workspace_id: workspaceId,
      name: "config_autopilot",
      category: "autopilot",
      body: payload,
    });
  }
}

const autoReplySchema = z.object({
  intent: z.enum(["interessado", "duvida", "objecao", "sem_interesse", "descadastro", "outros"]),
  reply: z.string(),
  reasoning: z.string().optional(),
});

/** Processa e envia uma resposta 100% autônoma se o Piloto Automático estiver ligado */
export async function processAutopilotReply(params: {
  workspaceId: string;
  phone: string;
  incomingText: string;
  contactId?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const { workspaceId, phone, incomingText, contactId } = params;

  // 1. Verifica se está ativo
  const config = await getAutopilotConfig(workspaceId);
  if (!config.enabled) {
    return { sent: false, reason: "autopilot_disabled" };
  }

  // 2. Busca histórico recente de mensagens para contexto
  const { data: history } = await supabaseAdmin
    .from("wa_messages")
    .select("direction, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(4);

  const contextThread = (history ?? [])
    .reverse()
    .map((m) => `${m.direction === "in" ? "Cliente" : "Atendente"}: ${m.body}`)
    .join("\n");

  const systemPrompt = `${config.instruction || DEFAULT_INSTRUCTION}
Você está respondendo DIRETAMENTE pelo WhatsApp. Mantenha a resposta curta (1 a 3 parágrafos curtos, máx 350 caracteres).
Se o cliente tiver interesse, tire as dúvidas e proponha dar o próximo passo. Se pedir para sair/cancelar, confirme a saída educadamente.
Saída estruturada: 'intent' (interessado | duvida | objecao | sem_interesse | descadastro | outros) e 'reply' (o texto exato da mensagem pronta para enviar).`;

  const userPrompt = `Histórico da conversa recente:\n${contextThread}\n\nÚltima mensagem do cliente:\n"${incomingText}"`;

  try {
    const aiResult = await aiObject(autoReplySchema, systemPrompt, userPrompt);
    const replyText = aiResult.reply?.trim();
    if (!replyText) return { sent: false, reason: "empty_reply" };

    // 3. Envia via Evolution API
    const base = (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, "");
    const key = process.env["EVOLUTION_API_KEY"] ?? "";
    if (!base || !key) return { sent: false, reason: "gateway_not_configured" };

    const instName = `zp-${workspaceId.slice(0, 8)}`;
    const r = await fetch(`${base}/message/sendText/${instName}`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({
        number: phone,
        text: replyText,
        delay: 2000 + Math.floor(Math.random() * 2000), // Simula tempo de digitação
      }),
    });

    const j = (await r.json().catch(() => ({}))) as any;
    const extId = j?.key?.id ?? null;

    // 4. Registra no banco como mensagem enviada
    await supabaseAdmin.from("wa_messages").upsert(
      {
        workspace_id: workspaceId,
        contact_id: contactId ?? null,
        phone,
        direction: "out",
        body: replyText,
        external_id: extId,
        read: true,
      },
      { onConflict: "workspace_id,external_id", ignoreDuplicates: true }
    );

    // 5. Se o cliente demonstrou interesse, avança no funil
    if (aiResult.intent === "interessado") {
      await supabaseAdmin
        .from("contacts")
        .update({ stage: "interessado" })
        .eq("workspace_id", workspaceId)
        .eq("phone", phone)
        .in("stage", ["novo", "contatado", "respondeu"]);
    }

    return { sent: true };
  } catch (err: any) {
    console.error("Autopilot error:", err?.message || err);
    return { sent: false, reason: err?.message };
  }
}
