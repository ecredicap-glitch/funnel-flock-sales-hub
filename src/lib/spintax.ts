// {a|b|c} picks one option at random (nested ok); {{var}} is replaced by contact data.
export function spin(text: string, rnd: () => number = Math.random): string {
  let out = text.replace(/\{\{(\w+)\}\}/g, "\u0000$1\u0001");
  const re = /\{([^{}]*)\}/;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out))) {
    const opts = m[1]!.split("|");
    out = out.slice(0, m.index) + opts[Math.floor(rnd() * opts.length)] + out.slice(m.index + m[0].length);
  }
  return out.replace(/\u0000(\w+)\u0001/g, "{{$1}}");
}
export function fillVars(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] ?? "").toString().trim());
}
export function render(text: string, vars: Record<string, string | null | undefined>, rnd?: () => number) {
  return fillVars(spin(text, rnd), vars).replace(/ {2,}/g, " ").replace(/ ([,!?.])/g, "$1");
}
