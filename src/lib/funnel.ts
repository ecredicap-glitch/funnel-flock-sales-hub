export const STAGES = [
  { id: "novo", label: "Novo", hint: "Contato importado que ainda não recebeu mensagem." },
  { id: "contatado", label: "Contatado", hint: "Recebeu mensagem de campanha ou cadência. Entra aqui sozinho." },
  { id: "respondeu", label: "Respondeu", hint: "O cliente respondeu no WhatsApp. Entra aqui sozinho e as cadências dele param." },
  { id: "interessado", label: "Interessado", hint: "A IA identificou interesse (botão Sugerir resposta em Conversas) ou você moveu." },
  { id: "proposta", label: "Proposta", hint: "Você apresentou uma proposta ou simulação." },
  { id: "fechado", label: "Fechado", hint: "Negócio fechado." },
  { id: "perdido", label: "Perdido", hint: "Sem interesse ou não seguiu." },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export const PRODUCTS = [
  { id: "credito", label: "Crédito" },
  { id: "consorcio", label: "Consórcio" },
  { id: "limpa_nome", label: "Limpa Nome" },
  { id: "rating", label: "Rating" },
  { id: "outro", label: "Outro" },
] as const;
export const productLabel = (p: string | null) => PRODUCTS.find((x) => x.id === p)?.label ?? null;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "há 3 d", "há 5 h" */
export function since(iso: string, now = Date.now()) {
  const h = Math.floor((now - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return "agora";
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
