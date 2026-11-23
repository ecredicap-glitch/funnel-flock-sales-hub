import { describe, it, expect } from "vitest";
import { cleanContactName, extractFirstName } from "@/lib/contact-name";

describe("contact-name sanitization", () => {
  it("strips MEI cnpj prefix with dots", () => {
    expect(cleanContactName("68.407.051 Davi Vidal Paulino")).toBe("Davi Vidal Paulino");
    expect(extractFirstName("68.407.051 Davi Vidal Paulino")).toBe("Davi");
  });

  it("handles full CNPJ with slashes and dashes", () => {
    expect(cleanContactName("12.345.678/0001-90 Joao da Silva")).toBe("Joao da Silva");
    expect(extractFirstName("12.345.678/0001-90 Joao da Silva")).toBe("Joao");
  });

  it("converts all-caps names into title case", () => {
    expect(extractFirstName("68.407.051 DAVI VIDAL")).toBe("Davi");
    expect(extractFirstName("CARLOS EDUARDO")).toBe("Carlos");
  });

  it("preserves standard company and individual names", () => {
    expect(cleanContactName("Top Pizza LTDA")).toBe("Top Pizza LTDA");
    expect(extractFirstName("Top Pizza LTDA")).toBe("Top");
    expect(extractFirstName("Ana Maria")).toBe("Ana");
  });

  it("handles empty or null values gracefully", () => {
    expect(cleanContactName(null)).toBeNull();
    expect(cleanContactName("")).toBeNull();
    expect(extractFirstName(null)).toBe("");
    expect(extractFirstName("")).toBe("");
  });
});
