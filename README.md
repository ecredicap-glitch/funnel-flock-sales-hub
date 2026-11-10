# Funnel Flock Sales Hub

Construa um web app SaaS chamado "ZapPilot" (nome provisório): uma plataforma de disparo e relacionamento em massa via WhatsApp, focada em funil de vendas. Interface 100% em português do Brasil. Voltada a uma intermediadora financeira (crédito, consórcio, limpa nome, rating bancário), mas genérica o suficiente para outros negócios.

## STACK

- React + TypeScript + Tailwind + shadcn/ui

- Backend: Lovable Cloud / Supabase (Auth, Postgres com RLS, Edge Functions, Realtime)

- NÃO usar a API oficial do WhatsApp por enquanto. Criar uma CAMADA DE PROVEDOR (interface `WhatsAppProvider` com métodos: createInstance, getQrCode, getStatus, sendText, sendMedia, disconnect, e handler de webhook). Implementar o adaptador `EvolutionProvider` (Evolution API open source, hospedada por mim, configurada por URL base + API key nas Configurações). Deixar um adaptador `OfficialCloudProvider` apenas como esqueleto vazio para uso futuro.

- Webhook recebido por Edge Function: eventos de mensagem recebida, status (enviada/entregue/lida), conexão (conectado/desconectado).

- Guardar secrets (API key do gateway) apenas no backend, nunca no frontend.

## IDENTIDADE VISUAL (diferente de um painel padrão verde)

- Tema escuro por padrão (com toggle para claro): fundo azul-marinho profundo, cor de destaque lima/neon (#B6F500) e secundária azul elétrico. Cantos arredondados grandes, cards com leve glassmorphism, microanimações suaves.

- Layout "cockpit": em vez de sidebar longa, usar uma barra lateral compacta só com ícones (expansível ao passar o mouse) + barra superior com busca global tipo Command Palette (Ctrl+K) para navegar, criar campanha, buscar contato.

- Tipografia moderna (Inter ou Plus Jakarta Sans). Totalmente responsivo; no celular, navegação inferior.

- Estados vazios ilustrados com orientação do próximo passo.

## TELAS

1. **Cockpit (home)**

   - Faixa de "Saúde do número": indicador 0–100 por número conectado (considera taxa de falha, descadastros, volume do dia vs. limite, idade da conexão), com cor verde/amarelo/vermelho e dica do que fazer.

   - Cartões: contatos, enviadas hoje, taxa de entrega, taxa de resposta, descadastros, créditos/limite diário restante.

   - Gráfico de envios x respostas (7/30 dias) e "Melhor horário de resposta" (heatmap por dia/hora calculado das respostas reais).

   - Lista "Próximas ações": campanhas agendadas, follow-ups do dia, leads quentes sem resposta há 24h.

2. **Funil (Kanban de leads)**

   - Colunas editáveis, padrão: Novo → Contatado → Respondeu → Interessado → Proposta → Fechado → Perdido.

   - Arrastar e soltar. Card do lead mostra nome, telefone, origem, última mensagem, tag de produto (Crédito, Consórcio, Limpa Nome, Rating).

   - Mover de coluna pode disparar uma automação (ex.: ao ir para "Proposta", enviar template X).

3. **Contatos e Listas**

   - Importação CSV/XLSX com mapeamento de colunas, normalização de telefone para formato internacional (55 + DDD + número), deduplicação e validação (marcar inválidos).

   - Tags, listas, campos personalizados (ex.: valor desejado, cidade, produto de interesse).

   - Campo obrigatório de consentimento (opt-in): origem e data. Contatos sem opt-in não podem entrar em campanha.

   - Bloqueados e descadastrados em aba separada.

4. **Campanhas**

   - Wizard em 4 passos: público (lista/tags/filtros) → mensagem → regras de envio → revisão e agendamento.

   - Editor de mensagem com variáveis ({{nome}}, {{produto}}, etc.), pré-visualização estilo balão do WhatsApp e SUPORTE A VARIAÇÕES (spintax: "{Olá|Oi|E aí} {{nome}}") para que cada mensagem seja única.

   - Anexos: imagem, PDF, áudio.

   - Barra de progresso em tempo real (Realtime), com pausar, continuar e cancelar.

   - Relatório por campanha: enviadas, entregues, lidas, respondidas, falhas, descadastros, e botão "Segmentar quem respondeu" para criar nova lista.

5. **Cadências (sequências automáticas)**

   - Construtor visual simples: Mensagem → Espera (X horas/dias) → Condição (respondeu? sim/não) → Próxima mensagem.

   - Parar a cadência automaticamente quando o lead responder ou pedir para sair.

6. **Caixa de entrada (Conversas)**

   - Chat em tempo real estilo WhatsApp Web, com histórico, notas internas e atribuição a atendente.

   - Cada resposta recebida é classificada por IA em: Interessado, Dúvida, Sem interesse, Pedido de descadastro, Outros. Usar Lovable AI (Edge Function) para a classificação e mostrar a etiqueta na conversa. Se for "Interessado", mover o lead automaticamente para a coluna correspondente do Funil.

   - Respostas rápidas salvas.

7. **Templates**

   - Biblioteca de modelos por categoria (primeiro contato, follow-up, proposta, reativação), com variáveis e variações. Já incluir 8 exemplos para o setor financeiro, em tom consultivo e sem promessas de aprovação garantida.

8. **WhatsApp (conexão)**

   - Fluxo: criar instância → exibir QR Code (atualiza automaticamente) → status em tempo real → desconectar/reconectar.

   - Suporte a múltiplos números, cada um com seu limite diário e sua saúde.

   - Aviso claro e visível: "Conexão não oficial. Use um número secundário e apenas contatos com consentimento."

9. **Planos e créditos**

   - Controle interno de mensagens (saldo, validade, consumo por campanha) com alerta de saldo baixo. Sem gateway de pagamento por enquanto (apenas estrutura de dados).

10. **Privacidade & LGPD / Auditoria / Configurações**

    - Log de auditoria (quem fez o quê e quando), exportação e exclusão de dados de um contato, texto padrão de opt-out editável, configurações do gateway e usuários da equipe com papéis (Admin, Operador).

## REGRAS DE ENVIO (ANTI-BANIMENTO) — OBRIGATÓRIAS NO MOTOR DE FILA

- Fila no banco com processamento por Edge Function agendada (cron), nunca disparo simultâneo.

- Intervalo ALEATÓRIO entre mensagens (padrão 15–45 s, configurável) e pausa maior a cada lote (ex.: a cada 20 mensagens, 3–8 min).

- Simular "digitando..." por alguns segundos antes de enviar, quando o gateway permitir.

- Limite diário por número, com modo "Aquecimento": começa em 20/dia e aumenta gradualmente por dias (rampa configurável) para números novos.

- Janela de horário permitida (ex.: 8h–19h, seg–sáb), respeitando fuso America/Belem.

- Deduplicação por telefone normalizado dentro da mesma campanha e em janela de X dias.

- Opt-out automático: se o lead responder "SAIR", "PARAR" ou similar, marcar como descadastrado, cancelar cadências e confirmar com uma mensagem única.

- Pausa automática da campanha se a taxa de falha passar de 15% ou se o número desconectar, com notificação no painel.

- Retentativa limitada (máx. 2) para falhas temporárias.

## BANCO DE DADOS (tabelas principais, todas com RLS por workspace)

workspaces, members, wa_instances, contacts, contact_lists, list_contacts, tags, custom_fields, pipeline_stages, leads, templates, campaigns, campaign_messages (fila), cadences, cadence_steps, cadence_runs, conversations, messages, message_events, optouts, credits_ledger, audit_logs.

## ORDEM DE CONSTRUÇÃO (faça em etapas e pare para eu validar ao fim de cada uma)

1. Auth, workspace, layout cockpit, tema, navegação e Command Palette.

2. Contatos, listas, importação CSV e opt-in.

3. Camada de provedor + tela WhatsApp (QR Code, status) + webhook.

4. Templates, editor com spintax e campanhas com motor de fila anti-banimento.

5. Caixa de entrada em tempo real + classificação por IA.

6. Funil Kanban + cadências.

7. Cockpit com saúde do número, relatórios, auditoria e LGPD.

Comece apenas pela etapa 1 e me diga o que precisa que eu configure.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/00cac890-075e-5664-815c-6b5cbf4c1503).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
