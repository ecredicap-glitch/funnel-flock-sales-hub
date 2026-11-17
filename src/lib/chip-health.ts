export type ChipHealthParams = {
  connected: boolean;
  sentToday?: number;
  failedToday?: number;
  dailyLimit?: number;
  optouts?: number;
  connectionDays?: number;
};

export type ChipHealth = {
  score: number;
  status: "excelente" | "bom" | "atencao" | "risco";
  statusLabel: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  reason: string;
  suggestions: string[];
  warmupPhase: "aquecimento" | "estavel" | "maduro";
  warmupLabel: string;
  failRate: number;
};

export function calculateChipHealth({
  connected,
  sentToday = 0,
  failedToday = 0,
  dailyLimit = 20,
  optouts = 0,
  connectionDays = 3,
}: ChipHealthParams): ChipHealth {
  if (!connected) {
    return {
      score: 0,
      status: "risco",
      statusLabel: "Desconectado",
      badgeVariant: "destructive",
      reason: "O WhatsApp está desconectado. Disparos e respostas automáticas estão pausados.",
      suggestions: ["Acesse a tela do WhatsApp e escaneie o QR Code para restabelecer a conexão."],
      warmupPhase: "aquecimento",
      warmupLabel: "Desconectado",
      failRate: 0,
    };
  }

  let score = 100;
  const suggestions: string[] = [];

  // 1. Taxa de falhas nas últimas 24h
  const totalAttempts = sentToday + failedToday;
  const failRate = totalAttempts > 0 ? failedToday / totalAttempts : 0;

  if (totalAttempts >= 5) {
    if (failRate > 0.15) {
      score -= 40;
      suggestions.push("Taxa de falhas acima de 15%. Revise se os contatos da lista são números de WhatsApp válidos.");
    } else if (failRate > 0.05) {
      score -= Math.round(failRate * 150);
      suggestions.push("Algumas mensagens não foram entregues. Mantenha os intervalos entre envios elevados.");
    }
  }

  // 2. Volume de disparos vs Limite Diário de Aquecimento
  const effectiveLimit = Math.max(1, dailyLimit);
  const usageRatio = sentToday / effectiveLimit;

  if (usageRatio >= 1) {
    score -= 20;
    suggestions.push(`Limite diário atingido (${sentToday}/${effectiveLimit}). Pause novos disparos para evitar suspensão.`);
  } else if (usageRatio >= 0.85) {
    score -= 10;
    suggestions.push(`Volume de envios atingiu ${Math.round(usageRatio * 100)}% do teto diário recomendado.`);
  }

  // 3. Descadastros (opt-outs)
  if (optouts > 0) {
    score -= Math.min(25, optouts * 5);
    if (optouts >= 3) {
      suggestions.push("Houve múltiplos pedidos de descadastro. Certifique-se de disparar apenas para contatos com opt-in prévio.");
    }
  }

  // 4. Idade da conexão e Maturação
  let warmupPhase: "aquecimento" | "estavel" | "maduro" = "aquecimento";
  let warmupLabel = "Fase de Aquecimento (< 7 dias)";

  if (connectionDays >= 30) {
    warmupPhase = "maduro";
    warmupLabel = "Chip Maduro (> 30 dias)";
  } else if (connectionDays >= 7) {
    warmupPhase = "estavel";
    warmupLabel = "Chip Estável (7-30 dias)";
  } else {
    // Penalidade leve inicial para chips em fase inicial de aquecimento
    score = Math.min(score, 90);
    suggestions.push("Chip novo em aquecimento: mantenha mensagens com spintax e respeite o limite inicial de 20 envios/dia.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Reputação saudável! Mantenha mensagens personalizadas e respeite os intervalos aleatórios.");
  }

  const finalScore = Math.max(10, Math.min(100, score));

  let status: "excelente" | "bom" | "atencao" | "risco" = "excelente";
  let statusLabel = "Excelente";
  let badgeVariant: ChipHealth["badgeVariant"] = "default";
  let reason = "Conexão estável e métricas anti-banimento sob controle.";

  if (failRate > 0.15 || finalScore < 40) {
    status = "risco";
    statusLabel = "Risco de Bloqueio";
    badgeVariant = "destructive";
    reason = "Taxa de falhas alta ou uso excessivo detectado nas últimas 24h.";
  } else if (finalScore < 65) {
    status = "atencao";
    statusLabel = "Atenção";
    badgeVariant = "secondary";
    reason = "Volume próximo ao limite ou aumento de descadastros.";
  } else if (finalScore < 85) {
    status = "bom";
    statusLabel = "Bom";
    badgeVariant = "outline";
    reason = "Reputação positiva, chip em ritmo constante de envios.";
  }

  return {
    score: finalScore,
    status,
    statusLabel,
    badgeVariant,
    reason,
    suggestions,
    warmupPhase,
    warmupLabel,
    failRate,
  };
}
