import { describe, it, expect } from "vitest";
import { inWindow, nextDelaySeconds, shouldAutoPause, belemDayStart, MAX_ATTEMPTS } from "@/lib/send-engine";
import { render, spin } from "@/lib/spintax";

const cfg = { min_interval_s: 15, max_interval_s: 45, batch_size: 20, batch_pause_min: 3, batch_pause_max: 8 };
describe("anti-ban", () => {
  it("window 8h–19h Belém, Mon–Sat", () => {
    expect(inWindow(new Date("2026-11-12T11:00:00Z"), 8, 19, [1,2,3,4,5,6])).toBe(true); // Thu 08:00 Belém
    expect(inWindow(new Date("2026-11-12T10:59:00Z"), 8, 19, [1,2,3,4,5,6])).toBe(false);
    expect(inWindow(new Date("2026-11-12T22:00:00Z"), 8, 19, [1,2,3,4,5,6])).toBe(false); // 19:00
    expect(inWindow(new Date("2026-11-15T14:00:00Z"), 8, 19, [1,2,3,4,5,6])).toBe(false); // Sunday
  });
  it("interval between 15 and 45 s", () => {
    expect(nextDelaySeconds(3, cfg, () => 0).seconds).toBe(15);
    expect(nextDelaySeconds(3, cfg, () => 0.9999).seconds).toBe(45);
  });
  it("batch pause 3–8 min after 20 messages", () => {
    const r = nextDelaySeconds(20, cfg, () => 0);
    expect(r).toEqual({ seconds: 180, resetBatch: true });
    expect(nextDelaySeconds(20, cfg, () => 0.9999).seconds).toBe(480);
  });
  it("auto-pause above 15% failures", () => {
    expect(shouldAutoPause(85, 15)).toBe(false);
    expect(shouldAutoPause(84, 16)).toBe(true);
  });
  it("max 2 retries", () => expect(MAX_ATTEMPTS).toBe(3));
  it("Belém day starts 03:00 UTC", () => expect(belemDayStart(new Date("2026-11-12T02:00:00Z")).toISOString()).toBe("2026-11-11T03:00:00.000Z"));
});
describe("spintax", () => {
  it("picks options and fills vars", () => {
    expect(render("{Oi|Olá} {{nome}}, tudo bem?", { nome: "Ana" }, () => 0)).toBe("Oi Ana, tudo bem?");
    expect(spin("{a|b}", () => 0.99)).toBe("b");
    expect(render("Olá {{nome}}!", {})).toBe("Olá!");
  });
});
