import { describe, it, expect } from "vitest";
import { shortName } from "./shortName";

describe("shortName", () => {
  it("имя и фамилия -> имя и инициал", () => expect(shortName("Анна Петрова")).toBe("Анна П."));
  it("три слова -> имя и инициал второго", () => expect(shortName("Анна Сергеевна Петрова")).toBe("Анна С."));
  it("одно слово как есть", () => expect(shortName("Анна")).toBe("Анна"));
  it("лишние пробелы и пустота", () => {
    expect(shortName("  Анна   Петрова  ")).toBe("Анна П.");
    expect(shortName("")).toBe("");
    expect(shortName(undefined)).toBe("");
  });
  it("логин с точкой или почта не режется", () => expect(shortName("anna.p")).toBe("anna.p"));
});
