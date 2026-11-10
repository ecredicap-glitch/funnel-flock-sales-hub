import {
  Gauge,
  KanbanSquare,
  MessagesSquare,
  Users,
  Megaphone,
  Workflow,
  LayoutTemplate,
  Smartphone,
  Coins,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to:
    | "/cockpit"
    | "/funil"
    | "/conversas"
    | "/contatos"
    | "/campanhas"
    | "/cadencias"
    | "/templates"
    | "/whatsapp"
    | "/planos"
    | "/privacidade"
    | "/configuracoes";
  label: string;
  icon: LucideIcon;
  keywords: string;
  /** Shown in the mobile bottom bar; the rest go under "Mais". */
  mobile?: boolean;
  group: "operacao" | "conta";
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/cockpit", label: "Cockpit", icon: Gauge, keywords: "inicio home painel dashboard", mobile: true, group: "operacao" },
  { to: "/funil", label: "Funil", icon: KanbanSquare, keywords: "kanban leads pipeline vendas", mobile: true, group: "operacao" },
  { to: "/conversas", label: "Conversas", icon: MessagesSquare, keywords: "caixa de entrada inbox chat", mobile: true, group: "operacao" },
  { to: "/contatos", label: "Contatos", icon: Users, keywords: "listas importar csv tags", group: "operacao" },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone, keywords: "disparo envio massa", mobile: true, group: "operacao" },
  { to: "/cadencias", label: "Cadências", icon: Workflow, keywords: "sequencia automacao follow-up", group: "operacao" },
  { to: "/templates", label: "Templates", icon: LayoutTemplate, keywords: "modelos mensagens spintax", group: "operacao" },
  { to: "/whatsapp", label: "WhatsApp", icon: Smartphone, keywords: "conexao numero qr code instancia", group: "conta" },
  { to: "/planos", label: "Planos e créditos", icon: Coins, keywords: "saldo limite consumo", group: "conta" },
  { to: "/privacidade", label: "Privacidade & LGPD", icon: ShieldCheck, keywords: "auditoria optout lgpd dados", group: "conta" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, keywords: "equipe usuarios gateway workspace", group: "conta" },
];
