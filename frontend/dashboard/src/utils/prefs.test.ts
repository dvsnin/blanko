import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api/client";
import { readPref, readPrefIn, savePrefs, flushPrefs } from "./prefs";

vi.mock("../api/client", () => ({ api: { account: { updatePrefs: vi.fn() } } }));

describe("prefs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.dashData = { accountId: "u1", prefs: { lastTeamId: "t2", "boards.view": "list", n: 3 } };
    vi.mocked(api.account.updatePrefs).mockResolvedValue({});
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); delete window.dashData; });

  it("readPref читает из dashData, readPrefIn отбрасывает неизвестные значения", () => {
    expect(readPref("lastTeamId")).toBe("t2");
    expect(readPref("missing")).toBeUndefined();
    expect(readPrefIn("boards.view", ["grid", "list"], "grid")).toBe("list");
    expect(readPrefIn("n", ["a", "b"], "a")).toBe("a");
    expect(readPrefIn("missing", ["a", "b"], "b")).toBe("b");
  });

  it("savePrefs сразу обновляет dashData и шлёт одну склеенную запись после паузы", () => {
    savePrefs({ lastTeamId: "t1" });
    savePrefs({ "boards.sort": "name", lastTeamId: "t3" });
    expect(readPref("lastTeamId")).toBe("t3");
    expect(api.account.updatePrefs).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(api.account.updatePrefs).toHaveBeenCalledTimes(1);
    expect(api.account.updatePrefs).toHaveBeenCalledWith({ lastTeamId: "t3", "boards.sort": "name" });
  });

  it("null удаляет ключ локально и уходит на сервер, flushPrefs шлёт без ожидания", () => {
    savePrefs({ "boards.view": null });
    expect(readPref("boards.view")).toBeUndefined();
    flushPrefs();
    expect(api.account.updatePrefs).toHaveBeenCalledWith({ "boards.view": null });
    flushPrefs();
    expect(api.account.updatePrefs).toHaveBeenCalledTimes(1);
  });

  it("без dashData запись не падает и ничего не шлёт", () => {
    delete window.dashData;
    savePrefs({ lastTeamId: "t1" });
    flushPrefs();
    expect(api.account.updatePrefs).not.toHaveBeenCalled();
  });
});
