import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const q = z.object({ ws: z.string().uuid(), t: z.string().length(64) });

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const p = q.safeParse({ ws: url.searchParams.get("ws"), t: url.searchParams.get("t") });
        if (!p.success) return new Response("bad request", { status: 400 });
        const { webhookToken, OPT_OUT } = await import("@/lib/wa-token.server");
        const expected = await webhookToken(p.data.ws);
        let diff = expected.length ^ p.data.t.length;
        for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (p.data.t.charCodeAt(i) || 0);
        if (diff !== 0) return new Response("unauthorized", { status: 401 });

        const payload = (await request.json().catch(() => null)) as any;
        const event = String(payload?.event ?? "").toLowerCase().replace("_", ".");
        if (event !== "messages.upsert") return new Response("ignored");
        const items: any[] = Array.isArray(payload?.data) ? payload.data : [payload?.data];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        for (const m of items) {
          const jid = String(m?.key?.remoteJid ?? "");
          if (!jid.endsWith("@s.whatsapp.net")) continue; // ignora grupos/status
          const phone = jid.split("@")[0]!.replace(/\D/g, "").slice(0, 20);
          const body = String(m?.message?.conversation ?? m?.message?.extendedTextMessage?.text ?? m?.message?.imageMessage?.caption ?? (m?.message ? "[mídia]" : "")).slice(0, 4000);
          if (!phone || !body) continue;
          const fromMe = !!m?.key?.fromMe;
          const { data: contact } = await supabaseAdmin.from("contacts").select("id").eq("workspace_id", p.data.ws).eq("phone", phone).maybeSingle();
          await supabaseAdmin.from("wa_messages").upsert({
            workspace_id: p.data.ws, contact_id: contact?.id ?? null, phone, push_name: fromMe ? null : (m?.pushName ?? null),
            direction: fromMe ? "out" : "in", body, external_id: m?.key?.id ?? null, read: fromMe,
          }, { onConflict: "workspace_id,external_id", ignoreDuplicates: true });
          if (!fromMe && contact && OPT_OUT.test(body)) {
            await supabaseAdmin.from("contacts").update({ status: "unsubscribed", status_reason: "Pediu para sair pelo WhatsApp" }).eq("id", contact.id);
          }
        }
        return new Response("ok");
      },
    },
  },
});
