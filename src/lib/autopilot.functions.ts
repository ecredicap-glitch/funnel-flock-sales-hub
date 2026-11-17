import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAutopilotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase.rpc("is_workspace_member", { _workspace_id: data.workspaceId });
    if (!member) throw new Error("Forbidden");
    const { getAutopilotConfig } = await import("@/lib/autopilot.server");
    return await getAutopilotConfig(data.workspaceId);
  });

export const updateAutopilotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          enabled: z.boolean(),
          instruction: z.string().max(2000).optional(),
        })
        .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_workspace_role", {
      _workspace_id: data.workspaceId,
      _role: "admin",
    });
    if (!admin) return { ok: false, error: "Apenas administradores podem alterar o Piloto Automático." };
    const { saveAutopilotConfig } = await import("@/lib/autopilot.server");
    await saveAutopilotConfig(data.workspaceId, {
      enabled: data.enabled,
      instruction: data.instruction,
    });
    return { ok: true };
  });
