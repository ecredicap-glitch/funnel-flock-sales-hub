import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Evolution API adapter (provider layer). Credentials are server-only.
const input = z.object({ workspaceId: z.string().uuid(), action: z.enum(["status", "connect", "logout"]) });

export type WaState = { state: "open" | "connecting" | "close" | "none"; qr: string | null; number: string | null; error?: string };

export const whatsappAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<WaState> => {
    const { data: member } = await context.supabase.rpc("is_workspace_member", { _workspace_id: data.workspaceId });
    if (!member) throw new Error("Forbidden");
    const base = (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, "");
    const key = process.env["EVOLUTION_API_KEY"] ?? "";
    if (!base || !key) return { state: "none", qr: null, number: null, error: "Gateway não configurado." };
    const name = `zp-${data.workspaceId.slice(0, 8)}`;
    const call = async (path: string, method = "GET", body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, headers: { apikey: key, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const j = (await r.json().catch(() => ({}))) as any;
      return { ok: r.ok, status: r.status, j };
    };
    try {
      const list = await call(`/instance/fetchInstances?instanceName=${name}`);
      const inst = Array.isArray(list.j) ? list.j.find((i: any) => (i.name ?? i.instance?.instanceName) === name) : null;
      const number = inst?.ownerJid ? String(inst.ownerJid).split("@")[0] : null;
      if (data.action === "logout") {
        if (inst) await call(`/instance/logout/${name}`, "DELETE");
        return { state: "close", qr: null, number: null };
      }
      if (!inst) {
        if (data.action === "status") return { state: "none", qr: null, number: null };
        const c = await call("/instance/create", "POST", { instanceName: name, qrcode: true, integration: "WHATSAPP-BAILEYS" });
        if (!c.ok) return { state: "none", qr: null, number: null, error: "Não foi possível criar a instância." };
        return { state: "connecting", qr: c.j?.qrcode?.base64 ?? null, number: null };
      }
      const st = await call(`/instance/connectionState/${name}`);
      const state = (st.j?.instance?.state ?? "close") as WaState["state"];
      if (state === "open") return { state, qr: null, number };
      if (data.action === "connect" || state === "connecting") {
        const q = await call(`/instance/connect/${name}`);
        return { state: "connecting", qr: q.j?.base64 ?? null, number: null };
      }
      return { state, qr: null, number: null };
    } catch (e) {
      console.error("evolution error", e);
      return { state: "none", qr: null, number: null, error: "Gateway indisponível." };
    }
  });
