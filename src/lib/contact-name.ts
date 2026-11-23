/**
 * Utilitários para higienização e extração de nomes de contatos.
 * Trata casos de MEI/PJ onde a Razão Social inicia com dígitos do CNPJ
 * (ex: "68.407.051 Davi Vidal Paulino" ou "12.345.678/0001-90 Joao da Silva").
 */

/**
 * Remove números de CNPJ, CPF ou identificadores numéricos no início de Razões Sociais.
 * Ex: "68.407.051 Davi Vidal Paulino" -> "Davi Vidal Paulino"
 * Ex: "12.345.678/0001-90 Joao da Silva" -> "Joao da Silva"
 */
export function cleanContactName(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^[\d./\-_]+\s*[-–—]?\s*/, "").trim();
  return s || null;
}

/**
 * Extrai o primeiro nome real do contato para uso em variáveis de template ({{nome}}).
 * Se o nome estiver em caixa alta completa (ex: "DAVI"), converte para Title Case ("Davi").
 */
export function extractFirstName(raw?: string | null): string {
  const cleaned = cleanContactName(raw);
  if (!cleaned) return "";
  const first = cleaned.split(/\s+/)[0] ?? "";
  if (!first) return "";

  // Se estiver em ALL CAPS com mais de 1 caractere, transforma em Title Case (ex: "DAVI" -> "Davi")
  if (first.length > 1 && first === first.toUpperCase()) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return first;
}
