import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import StarMark from "./StarMark";
import StarButton from "./StarButton";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// app.css в vitest отдаёт пустую строку через ?raw (он же подключён в setup), поэтому читаем файл
const app = readFileSync(resolve(__dirname, "../app.css"), "utf8");

// Метка избранного до наведения выглядит как кнопка звезды, которая появляется при наведении:
// тот же глиф, тот же размер и скругление, иначе звезда «меняется» при наведении на карточку.
describe("StarMark: метка избранного повторяет кнопку звезды", () => {
  it("рисует тот же глиф, что и StarButton в избранном состоянии", () => {
    const mark = render(<StarMark />).container.querySelector(".card-star-mark");
    const button = render(<StarButton isStarred />).container.querySelector(".star-wrap > .star-glyph");
    expect(mark?.textContent).toBe(button?.textContent);
    expect(mark?.querySelector("svg")).toBeNull();
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });

  it("app.css: размер и скругление как у кнопки, цвет глифа ink, без тени", () => {
    const rule = app.match(/\.card-star-mark\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/width:\s*36px/);
    expect(rule).toMatch(/height:\s*36px/);
    expect(rule).toMatch(/border-radius:\s*10px/);
    expect(rule).toMatch(/color:\s*var\(--ink\)/);
    expect(rule).not.toMatch(/box-shadow/);
  });
});
