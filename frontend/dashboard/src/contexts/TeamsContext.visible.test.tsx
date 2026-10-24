import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useVisibleRefresh, VISIBLE_REFRESH_MIN_MS } from "./TeamsContext";

function becomeVisible() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisibleRefresh", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("перечитывает при возврате на вкладку, но не чаще раза в полминуты", () => {
    const refresh = vi.fn(async () => {});
    let t = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => t);
    renderHook(() => useVisibleRefresh(refresh));

    becomeVisible();
    expect(refresh).not.toHaveBeenCalled(); // только что загрузились

    t += VISIBLE_REFRESH_MIN_MS + 1;
    becomeVisible();
    expect(refresh).toHaveBeenCalledTimes(1);

    t += 1000;
    becomeVisible();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("уход со вкладки ничего не перечитывает", () => {
    const refresh = vi.fn(async () => {});
    vi.spyOn(Date, "now").mockImplementation(() => 5_000_000);
    renderHook(() => useVisibleRefresh(refresh));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
