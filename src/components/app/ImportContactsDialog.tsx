import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const FIELDS = [
  { key: "phone", label: "Telefone *" },
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "city", label: "Cidade" },
  { key: "tags", label: "Tags (separadas por vírgula)" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];
const NONE = "__none";

function guess(header: string): FieldKey | null {
  const h = header.toLowerCase();
  if (/(tel|fone|cel|whats|phone|numero|número)/.test(h)) return "phone";
  if (/(nome|name)/.test(h)) return "name";
  if (/mail/.test(h)) return "email";
  if (/(cidade|city)/.test(h)) return "city";
  if (/(tag|etiqueta|produto)/.test(h)) return "tags";
  return null;
}

export function ImportContactsDialog({ workspaceId, userId, lists, onDone }: {
  workspaceId: string; userId: string; lists: { id: string; name: string }[]; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Record<FieldKey, string>>({ phone: NONE, name: NONE, email: NONE, city: NONE, tags: NONE });
  const [source, setSource] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [listId, setListId] = useState(NONE);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    const wb = XLSX.read(await f.arrayBuffer());
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const hs = Object.keys(data[0] ?? {});
    setRows(data); setHeaders(hs);
    const m = { phone: NONE, name: NONE, email: NONE, city: NONE, tags: NONE } as Record<FieldKey, string>;
    hs.forEach((h) => { const g = guess(h); if (g && m[g] === NONE) m[g] = h; });
    setMap(m);
  }

  const preview = (() => {
    if (map.phone === NONE) return null;
    const seen = new Set<string>(); let invalid = 0, dup = 0;
    const valid: Record<string, unknown>[] = [];
    for (const r of rows) {
      const p = normalizePhone(r[map.phone]);
      if (!p) { invalid++; continue; }
      if (seen.has(p)) { dup++; continue; }
      seen.add(p);
      const get = (k: FieldKey) => (map[k] === NONE ? null : String(r[map[k]] ?? "").trim() || null);
      valid.push({
        workspace_id: workspaceId, phone: p, name: get("name"), email: get("email"), city: get("city"),
        tags: (get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        opt_in: true, opt_in_source: source.trim(), opt_in_at: new Date().toISOString(), created_by: userId,
      });
    }
    return { valid, invalid, dup };
  })();

  async function submit() {
    if (!preview) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (let i = 0; i < preview.valid.length; i += 500) {
        const { data, error } = await supabase.from("contacts")
          .upsert(preview.valid.slice(i, i + 500) as never, { onConflict: "workspace_id,phone" }).select("id");
        if (error) throw error;
        ids.push(...(data ?? []).map((d) => d.id));
      }
      if (listId !== NONE && ids.length) {
        const { error } = await supabase.from("contact_list_members").upsert(
          ids.map((contact_id) => ({ contact_id, list_id: listId, workspace_id: workspaceId })), { ignoreDuplicates: true });
        if (error) throw error;
      }
      toast.success(`${ids.length} contatos importados`, { description: `${preview.invalid} inválidos e ${preview.dup} duplicados ignorados.` });
      setOpen(false); setRows([]); setHeaders([]); setConfirmed(false); setSource("");
      onDone();
    } catch (e) {
      toast.error("Falha na importação", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" />Importar planilha</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>CSV ou XLSX. Telefones viram 55 + DDD + número; inválidos e duplicados são descartados.</DialogDescription>
        </DialogHeader>
        <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {headers.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rows.length} linhas encontradas. Relacione as colunas:</p>
            {FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-2 items-center gap-2">
                <Label>{f.label}</Label>
                <Select value={map[f.key]} onValueChange={(v) => setMap({ ...map, [f.key]: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— ignorar —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="grid grid-cols-2 items-center gap-2">
              <Label>Adicionar à lista</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Origem do consentimento (opt-in) *</Label>
              <Input placeholder="Ex.: formulário do site, atendimento na loja" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
              Confirmo que todos esses contatos autorizaram receber mensagens (LGPD).
            </label>
            {preview && (
              <p className="rounded-xl bg-muted p-3 text-sm">
                <b>{preview.valid.length}</b> válidos · {preview.invalid} inválidos · {preview.dup} duplicados
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button disabled={busy || !preview?.valid.length || !confirmed || !source.trim()} onClick={submit}>
            {busy ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
