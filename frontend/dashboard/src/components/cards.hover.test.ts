import { describe, it, expect } from "vitest";
import boards from "./Boards.css?raw";
import list from "./Boards.list.css?raw";
import tpl from "./TemplateCard.css?raw";

/** Возвращает тела всех блоков `@media (hover: hover) { ... }` и остаток файла вне их. */
function splitHoverMedia(css: string): { inside: string; outside: string } {
  let inside = "";
  let outside = "";
  let i = 0;
  const marker = "@media (hover: hover)";
  while (i < css.length) {
    const at = css.indexOf(marker, i);
    if (at < 0) { outside += css.slice(i); break; }
    outside += css.slice(i, at);
    const open = css.indexOf("{", at);
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    inside += css.slice(open + 1, j - 1);
    i = j;
  }
  return { inside, outside };
}

// На тач-панели нет наведения: скрывать «⋯» у избранных и мету у шаблона можно только там, где наведение есть.
describe("карточки: правила «только при наведении» живут внутри @media (hover: hover)", () => {
  it.each([
    ["Boards.css", boards, ".board-menu-wrapper"],
    ["Boards.list.css", list, ".board-menu-wrapper"],
    ["TemplateCard.css", tpl, ".tpl-menu"],
  ])("%s: скрытие меню у избранных", (_name, css, menuSel) => {
    const { inside, outside } = splitHoverMedia(css);
    const hideRule = new RegExp(`--starred[^{]*${menuSel.replace(".", "\\.")}[^{]*\\{[^}]*visibility:\\s*hidden`);
    expect(inside).toMatch(hideRule);
    expect(outside).not.toMatch(hideRule);
    expect(outside).not.toMatch(/!important/);
  });

  it("TemplateCard.css: замена меты кнопками только при наведении", () => {
    const { inside, outside } = splitHoverMedia(tpl);
    expect(inside).toMatch(/\.tpl-card__meta\s*\{[^}]*display:\s*none/);
    expect(outside).not.toMatch(/\.tpl-card__meta\s*\{[^}]*display:\s*none/);
  });
});
