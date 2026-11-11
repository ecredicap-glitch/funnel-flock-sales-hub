/** Normaliza telefone brasileiro para 55 + DDD + número. Retorna null se inválido. */
export function normalizePhone(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d.startsWith("55")) return null;
  const rest = d.slice(2);
  if (rest.length !== 10 && rest.length !== 11) return null;
  const ddd = Number(rest.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (rest.length === 11 && rest[2] !== "9") return null;
  return d;
}

export function formatPhone(p: string): string {
  const r = p.slice(2);
  const ddd = r.slice(0, 2);
  const n = r.slice(2);
  return `+55 (${ddd}) ${n.length === 9 ? n.slice(0, 5) + "-" + n.slice(5) : n.slice(0, 4) + "-" + n.slice(4)}`;
}
