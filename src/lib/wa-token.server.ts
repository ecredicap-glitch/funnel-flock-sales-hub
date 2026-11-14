/** Token do webhook por workspace: sha256(EVOLUTION_API_KEY:workspaceId). Sem segredo extra. */
export async function webhookToken(workspaceId: string): Promise<string> {
  const key = process.env["EVOLUTION_API_KEY"] ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${key}:${workspaceId}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const OPT_OUT = /^\s*(sair|parar|pare|stop|cancelar|descadastrar|remover)\s*[.!]*\s*$/i;
