import { describe, it, expect } from "vitest";
import { pageTitle } from "./pageTitle";

// Заголовок вкладки: раздел, затем название сада, чтобы в узкой вкладке читался раздел.
describe("pageTitle", () => {
  it("раздел и название сада через точку", () => {
    expect(pageTitle({ name: "boards" }, "Детский сад")).toBe("Доски · Детский сад");
    expect(pageTitle({ name: "templates", age: "3-4" }, "Детский сад")).toBe("Шаблоны · Детский сад");
    expect(pageTitle({ name: "groups" }, "Детский сад")).toBe("Группы · Детский сад");
    expect(pageTitle({ name: "profile" }, "Детский сад")).toBe("Профиль · Детский сад");
  });
  it("без названия сада только раздел", () => {
    expect(pageTitle({ name: "boards" }, "")).toBe("Доски");
  });
});
