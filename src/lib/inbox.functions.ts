import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WEBHOOK_BASE = "https://project--00cac890-075e-5664-815c-6b5cbf4c1503-dev.lovable.app";

const evo = () => ({ base: (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, ""), key: process.env["EVOLUTION_API_KEY"] ?? "" });

/** Liga o webhook da Evolution para este workspace (somente admin). */
export const setupInboxWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: admin } = await context.supabase.rpc("has_workspace_role", { _workspace_id: data.workspaceId, _role: "admin" });
    if (!admin) return { ok: false, error: "Apenas administradores podem ativar o recebimento." };
    const { base, key } = evo();
    if (!base || !key) return { ok: false, error: "Gateway não configurado." };
    const { webhookToken } = await import("@/lib/wa-token.server");
    const url = `${WEBHOOK_BASE}/api/public/whatsapp/webhook?ws=${data.workspaceId}&t=${await webhookToken(data.workspaceId)}`;
    const r = await fetch(`${base}/webhook/set/zp-${data.workspaceId.slice(0, 8)}`, {
      method: "POST", headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ webhook: { enabled: true, url, webhookByEvents: false, webhookBase64: false, events: ["MESSAGES_UPSERT"] } }),
    });
    if (!r.ok) { console.error("webhook set", r.status, await r.text().catch(() => "")); return { ok: false, error: "A Evolution recusou a configuração. Confira se o número está conectado." }; }
    return { ok: true };
  });

/** Responde um cliente pela caixa de entrada. */
export const sendInboxReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid(), phone: z.string().regex(/^\d{10,15}$/), text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: member } = await context.supabase.rpc("is_workspace_member", { _workspace_id: data.workspaceId });
    if (!member) return { ok: false, error: "Sem acesso." };
    const { data: c } = await context.supabase.from("contacts").select("status").eq("workspace_id", data.workspaceId).eq("phone", data.phone).maybeSingle();
    if (c && c.status !== "active") return { ok: false, error: "Este contato pediu para sair ou está bloqueado." };
    const { base, key } = evo();
    if (!base || !key) return { ok: false, error: "Gateway não configurado." };
    const r = await fetch(`${base}/message/sendText/zp-${data.workspaceId.slice(0, 8)}`, {
      method: "POST", headers: { apikey: key, "content-type": "application/json" }, body: JSON.stringify({ number: data.phone, text: data.text }),
    });
    const j = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) return { ok: false, error: "O WhatsApp recusou o envio." };
    // O webhook também registra (fromMe); o external_id evita duplicar.
    await context.supabase.from("wa_messages").upsert({ workspace_id: data.workspaceId, phone: data.phone, direction: "out", body: data.text, external_id: j?.key?.id ?? null, read: true }, { onConflict: "workspace_id,external_id", ignoreDuplicates: true });
    return { ok: true };
  });
