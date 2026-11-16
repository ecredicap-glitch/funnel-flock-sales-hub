import { describe, it, expect } from "vitest";
import { advanceCadence, firstCadenceRun } from "@/lib/send-engine";

const steps = [{ wait_hours: 0, body: "a" }, { wait_hours: 48, body: "b" }, { wait_hours: 72, body: "c" }];
const now = new Date("2026-11-16T12:00:00Z");
describe("cadência", () => {
  it("primeiro passo sai na hora quando a espera é 0", () => {
    expect(firstCadenceRun(steps, now).toISOString()).toBe(now.toISOString());
  });
  it("segundo passo espera 48h após o primeiro envio", () => {
    const r = advanceCadence(steps, 0, now);
    expect(r.done).toBe(false);
    expect(r.nextRunAt!.toISOString()).toBe("2026-11-18T12:00:00.000Z");
  });
  it("termina após o último passo", () => {
    expect(advanceCadence(steps, 2, now).done).toBe(true);
  });
});
