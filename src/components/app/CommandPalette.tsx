import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Megaphone, Upload, Smartphone, LayoutTemplate, Moon, Sun, LogOut, Search, UserPlus } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/nav";
import { useTheme } from "@/lib/theme";

export function CommandPalette({
  open,
  onOpenChange,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const actions = [
    { label: "Criar campanha", icon: Megaphone, to: "/campanhas" as const, keywords: "nova disparo" },
    { label: "Importar contatos (CSV/XLSX)", icon: Upload, to: "/contatos" as const, keywords: "planilha" },
    { label: "Adicionar contato", icon: UserPlus, to: "/contatos" as const, keywords: "novo lead" },
    { label: "Conectar número de WhatsApp", icon: Smartphone, to: "/whatsapp" as const, keywords: "qr code instancia" },
    { label: "Novo template", icon: LayoutTemplate, to: "/templates" as const, keywords: "modelo mensagem" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, ações ou contatos…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          {actions.map((a) => (
            <CommandItem key={a.label} value={`${a.label} ${a.keywords}`} onSelect={() => run(() => navigate({ to: a.to }))}>
              <a.icon className="text-primary-ink" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navegar">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.to}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => run(() => navigate({ to: item.to }))}
            >
              <item.icon />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Contatos">
          <CommandItem value="buscar contato telefone nome" disabled>
            <Search />
            Busca de contatos — disponível após importar sua base
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Preferências">
          <CommandItem value="alternar tema claro escuro" onSelect={() => run(toggleTheme)}>
            {theme === "dark" ? <Sun /> : <Moon />}
            Mudar para tema {theme === "dark" ? "claro" : "escuro"}
          </CommandItem>
          <CommandItem value="sair logout" onSelect={() => run(onSignOut)}>
            <LogOut />
            Sair
            <CommandShortcut>⇧Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
