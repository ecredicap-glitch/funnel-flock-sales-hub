import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Bell, ChevronsUpDown, Check, LogOut, Moon, Search, Sun, Settings, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { NAV_ITEMS } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { profileQuery, ROLE_LABEL, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogoMark } from "./Logo";
import { CommandPalette } from "./CommandPalette";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-cockpit min-h-screen">
        <Rail />
        <div className="md:pl-[76px]">
          <Topbar onOpenPalette={() => setPaletteOpen(true)} onSignOut={signOut} />
          <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 md:pb-10">{children}</main>
        </div>
        <BottomNav onMore={() => setMoreOpen(true)} />
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Mais</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 py-4">
              {NAV_ITEMS.filter((i) => !i.mobile).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-muted/60 p-3 text-center text-xs font-medium"
                  activeProps={{ className: "ring-1 ring-primary text-primary-ink" }}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={signOut} />
      </div>
    </TooltipProvider>
  );
}

/** Compact icon rail; expands over the content on hover. */
function Rail() {
  const groups = [
    { id: "operacao", items: NAV_ITEMS.filter((i) => i.group === "operacao") },
    { id: "conta", items: NAV_ITEMS.filter((i) => i.group === "conta") },
  ];
  return (
    <aside className="group/rail fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col overflow-hidden border-r bg-rail p-3 backdrop-blur-xl transition-[width] duration-300 ease-out hover:w-60 hover:shadow-panel md:flex">
      <Link to="/cockpit" className="mb-6 flex items-center gap-3 px-1.5 pt-1">
        <LogoMark />
        <span className="whitespace-nowrap text-lg font-extrabold tracking-tight opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
          Zap<span className="text-primary-ink">Pilot</span>
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {groups.map((g, gi) => (
          <div key={g.id} className={cn("flex flex-col gap-1", gi > 0 && "mt-auto border-t pt-3")}>
            {g.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex h-11 items-center gap-3 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground [&_.rail-dot]:opacity-100 [&_svg]:text-primary-ink" }}
              >
                <span className="rail-dot absolute -left-3 h-6 w-1 rounded-r-full bg-primary opacity-0 transition-opacity" />
                <item.icon className="size-5 shrink-0" />
                <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({ onOpenPalette, onSignOut }: { onOpenPalette: () => void; onSignOut: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { userId } = useWorkspace();
  const { data: profile } = useQuery(profileQuery(userId));

  return (
    <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <Link to="/cockpit" className="md:hidden">
          <LogoMark className="size-9" />
        </Link>
        <WorkspaceSwitcher />
        <button
          onClick={onOpenPalette}
          className="glass ml-auto flex h-10 w-full max-w-md items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:ml-4"
        >
          <Search className="size-4" />
          <span className="truncate">Buscar ou executar…</span>
          <kbd className="ml-auto hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] sm:inline">
            Ctrl K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tema {theme === "dark" ? "claro" : "escuro"}</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Notificações" className="hidden sm:inline-flex">
                <Bell />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 rounded-2xl">
              <p className="text-sm font-semibold">Notificações</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tudo calmo por aqui. Alertas de campanha pausada, número desconectado e saldo baixo
                aparecerão aqui.
              </p>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Conta">
                <Avatar className="size-9 border">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-electric text-xs font-bold text-electric-foreground">
                    {initials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-2xl">
              <DropdownMenuLabel>
                <p className="truncate">{profile?.full_name ?? "Usuário"}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">
                  <Settings /> Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSignOut}>
                <LogOut /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function WorkspaceSwitcher() {
  const { memberships, current, setCurrentId } = useWorkspace();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function createWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("create_workspace", { _name: name.trim() });
    setSaving(false);
    if (error) return toast.error("Não foi possível criar o workspace.");
    await queryClient.invalidateQueries({ queryKey: ["memberships"] });
    setCurrentId(data);
    setDialogOpen(false);
    setName("");
    toast.success("Workspace criado.");
  }

  return (
    <>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Novo workspace</DialogTitle>
          <DialogDescription>Cada workspace tem seus próprios números, contatos e equipe.</DialogDescription>
        </DialogHeader>
        <form onSubmit={createWorkspace} className="space-y-4">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Prime Consórcios" maxLength={80} className="h-11 rounded-xl" />
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim()}>Criar workspace</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden h-10 max-w-[220px] items-center gap-2 rounded-xl px-2.5 text-left transition-colors hover:bg-accent sm:flex">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-electric text-xs font-bold text-electric-foreground">
            {current?.workspace.name.charAt(0).toUpperCase() ?? "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">{current?.workspace.name}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              {current ? ROLE_LABEL[current.role] : ""}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-2xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem key={m.workspace.id} onSelect={() => setCurrentId(m.workspace.id)}>
            <span className="truncate">{m.workspace.name}</span>
            {m.workspace.id === current?.workspace.id && <Check className="ml-auto text-primary-ink" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
          <Plus /> Novo workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.filter((i) => i.mobile);
  const moreActive = !items.some((i) => pathname.startsWith(i.to));
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl px-2 py-1.5 md:hidden">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium text-muted-foreground"
          activeProps={{ className: "text-primary-ink bg-accent" }}
        >
          <item.icon className="size-5" />
          {item.label}
        </Link>
      ))}
      <button
        onClick={onMore}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium text-muted-foreground",
          moreActive && "bg-accent text-primary-ink",
        )}
      >
        <MoreHorizontal className="size-5" />
        Mais
      </button>
    </nav>
  );
}
