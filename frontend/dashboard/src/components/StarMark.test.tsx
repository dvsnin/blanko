import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import StarMark from "./StarMark";
import StarButton from "./StarButton";

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
});
