import { describe, it, expect } from "vitest";
import boards from "./Boards.css?raw";
import list from "./Boards.list.css?raw";
import tpl from "./TemplateCard.css?raw";
import groups from "../pages/GroupsPage.css?raw";
import star from "./StarButton.css?raw";

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

// На тач-панели нет наведения: прятать действия можно только там, где наведение есть,
// а у избранной карточки видны обе кнопки, звезда и «⋯», всегда.
describe("карточки: правила «только при наведении» живут внутри @media (hover: hover)", () => {
  it.each([
    ["Boards.css", boards, "--starred .board-card__corner"],
    ["Boards.list.css", list, "--starred .board-row__actions"],
    ["TemplateCard.css", tpl, "--starred .tpl-card__corner"],
    ["GroupsPage.css", groups, "--starred .group-card__actions"],
  ])("%s: действия скрыты только в media, метка избранного уходит при наведении", (_name, css, starredSel) => {
    const { inside, outside } = splitHoverMedia(css);
    const hiddenActions = /(__corner|__actions)\s*\{[^}]*opacity:\s*0\s*;/;
    expect(inside).toMatch(hiddenActions);
    expect(outside).not.toMatch(hiddenActions);
    expect(inside).not.toContain(starredSel); // избранное не включает кнопки: у него метка
    expect(inside).toMatch(/:hover \.card-star-mark[^{]*\{[^}]*display:\s*none/);
    expect(css).not.toMatch(/visibility:\s*hidden/);
    expect(outside).not.toMatch(/!important/);
  });

  it("TemplateCard.css: замена меты кнопками только при наведении", () => {
    const { inside, outside } = splitHoverMedia(tpl);
    expect(inside).toMatch(/\.tpl-card__meta\s*\{[^}]*display:\s*none/);
    expect(outside).not.toMatch(/\.tpl-card__meta\s*\{[^}]*display:\s*none/);
  });
});

// Попап меню рисуется внутри карточки: без z-index у карточки с открытым меню соседи ниже по DOM
// перекрывают его (заметно на шаблонах, где меню не в портале).
describe("карточка с открытым меню выше соседей", () => {
  it("TemplateCard.css: .tpl-card--menu-open поднимает z-index", () => {
    expect(tpl).toMatch(/\.tpl-card--menu-open[^{]*\{[^}]*z-index:\s*[1-9]/);
  });
});

// Метка избранного до наведения повторяет кнопку звезды: тот же размер и скругление, иначе звезда
// «меняется» при наведении на карточку. Проверяется здесь, а не рядом с компонентом: ?raw пуст,
// если тот же css уже импортирован компонентом в этом тесте.
describe("StarButton.css: метка избранного выглядит как кнопка", () => {
  it(".card-star-mark: 36px, radius 10px, цвет глифа ink, без тени", () => {
    const rule = star.match(/\.card-star-mark\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/width:\s*36px/);
    expect(rule).toMatch(/height:\s*36px/);
    expect(rule).toMatch(/border-radius:\s*10px/);
    expect(rule).toMatch(/color:\s*var\(--ink\)/);
    expect(rule).not.toMatch(/box-shadow/);
  });
});
