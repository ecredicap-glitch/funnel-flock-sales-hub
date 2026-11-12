import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { inWindow, belemDayStart, nextDelaySeconds, shouldAutoPause, MAX_ATTEMPTS } from "@/lib/send-engine";

// Runs every minute: sends at most ONE message per running campaign, respecting anti-ban rules.
export const Route = createFileRoute("/api/public/jobs/send-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const base = (process.env["EVOLUTION_API_URL"] ?? "").replace(/\/$/, "");
        const key = process.env["EVOLUTION_API_KEY"] ?? "";
        const now = new Date();
        const { data: camps } = await db.from("campaigns").select("*").eq("status", "running");
        const results: string[] = [];
        for (const c of camps ?? []) {
          if (c.start_at && new Date(c.start_at) > now) continue;
          if (c.next_send_at && new Date(c.next_send_at) > now) continue;
          if (!inWindow(now, c.window_start, c.window_end, c.window_days)) continue;
          const pause = (reason: string) => db.from("campaigns").update({ status: "paused", pause_reason: reason }).eq("id", c.id);
          const { count: today } = await db.from("campaign_messages").select("id", { count: "exact", head: true })
            .eq("workspace_id", c.workspace_id).eq("status", "sent").gte("sent_at", belemDayStart(now).toISOString());
          if ((today ?? 0) >= c.daily_limit) continue;
          const { data: msg } = await db.from("campaign_messages").select("*").eq("campaign_id", c.id).eq("status", "queued").order("created_at").limit(1).maybeSingle();
          if (!msg) { await db.from("campaigns").update({ status: "completed" }).eq("id", c.id); continue; }
          if (!base || !key) { await pause("Gateway não configurado."); continue; }
          const inst = `zp-${c.workspace_id.slice(0, 8)}`;
          // Contact may have opted out / been blocked after enqueue
          if (msg.contact_id) {
            const { data: ct } = await db.from("contacts").select("status, opt_in").eq("id", msg.contact_id).maybeSingle();
            if (!ct || ct.status !== "active" || !ct.opt_in) { await db.from("campaign_messages").update({ status: "skipped", error: "Contato sem opt-in ou descadastrado" }).eq("id", msg.id); continue; }
          }
          const st = await fetch(`${base}/instance/connectionState/${inst}`, { headers: { apikey: key } }).then((r) => r.json()).catch(() => null) as any;
          if (st?.instance?.state !== "open") { await pause("Número desconectado."); continue; }
          let ok = false; let err = "";
          try {
            const r = await fetch(`${base}/message/sendText/${inst}`, { method: "POST", headers: { apikey: key, "content-type": "application/json" },
              body: JSON.stringify({ number: msg.phone, text: msg.body, delay: 1500 + Math.floor(Math.random() * 2500) }) });
            ok = r.ok; if (!ok) err = `HTTP ${r.status}`;
          } catch (e) { err = String(e).slice(0, 200); }
          const attempts = msg.attempts + 1;
          let sent = c.sent, failed = c.failed;
          if (ok) { sent++; await db.from("campaign_messages").update({ status: "sent", attempts, sent_at: now.toISOString(), error: null }).eq("id", msg.id); }
          else if (attempts < MAX_ATTEMPTS) await db.from("campaign_messages").update({ attempts, error: err }).eq("id", msg.id);
          else { failed++; await db.from("campaign_messages").update({ status: "failed", attempts, error: err }).eq("id", msg.id); }
          const d = nextDelaySeconds(c.sent_in_batch + 1, c);
          const upd: Record<string, unknown> = { sent, failed, sent_in_batch: d.resetBatch ? 0 : c.sent_in_batch + 1, next_send_at: new Date(now.getTime() + d.seconds * 1000).toISOString() };
          if (shouldAutoPause(sent, failed)) Object.assign(upd, { status: "paused", pause_reason: "Taxa de falhas acima de 15%." });
          await db.from("campaigns").update(upd).eq("id", c.id);
          results.push(`${c.id}:${ok ? "sent" : "fail"}`);
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});
