import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("adiciona 55 a DDD + celular", () => expect(normalizePhone("(91) 98888-7777")).toBe("5591988887777"));
  it("mantém número já com 55", () => expect(normalizePhone("+55 11 3333-4444")).toBe("551133334444"));
  it("remove zero à esquerda", () => expect(normalizePhone("091988887777")).toBe("5591988887777"));
  it("rejeita celular de 11 dígitos sem 9", () => expect(normalizePhone("91888887777")).toBeNull());
  it("rejeita números curtos ou estrangeiros", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("14155552671")).toBeNull();
  });
});
