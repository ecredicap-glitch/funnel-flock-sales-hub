import { cn } from "@/lib/utils";

export function healthTone(value: number) {
  if (value >= 70) return { stroke: "var(--success)", label: "Saudável", className: "text-success" };
  if (value >= 40) return { stroke: "var(--warning)", label: "Atenção", className: "text-warning" };
  return { stroke: "var(--destructive)", label: "Risco", className: "text-destructive" };
}

/** Circular 0–100 gauge colored green / yellow / red. */
export function HealthRing({
  value,
  size = 72,
  className,
}: {
  value: number | null;
  size?: number;
  className?: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const tone = healthTone(v);
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        {value != null && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (v / 100) * c}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)" }}
          />
        )}
      </svg>
      <span className="tabular absolute text-lg font-extrabold">{value == null ? "—" : v}</span>
    </div>
  );
}
