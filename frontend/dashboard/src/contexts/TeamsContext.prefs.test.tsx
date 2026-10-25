import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act, waitFor } from "@testing-library/react";
import { TeamsProvider, useTeams } from "./TeamsContext";
import { api } from "../api/client";
import { flushPrefs } from "../utils/prefs";
import { teamDTOs, firstBoard, page } from "./TeamsContext.boards.fixture";

vi.mock("../api/client", () => ({
  api: {
    teams: { list: vi.fn() },
    boards: { list: vi.fn() },
    account: { updatePrefs: vi.fn() },
  },
}));

function Probe() {
  const { activeTeamId, setActiveTeamId } = useTeams();
  return (
    <div>
      <span data-testid="active">{activeTeamId ?? "-"}</span>
      <button onClick={() => setActiveTeamId("t2")}>t2</button>
    </div>
  );
}

// В фикстуре доски есть только у t1: без настройки эвристика выбирает её.
describe("TeamsContext: активная группа из настроек аккаунта", () => {
  beforeEach(() => {
    vi.mocked(api.teams.list).mockResolvedValue(teamDTOs);
    vi.mocked(api.boards.list).mockResolvedValue(page([firstBoard]));
    vi.mocked(api.account.updatePrefs).mockResolvedValue({});
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.dashData; });

  it("берёт lastTeamId из dashData.prefs, если такая группа есть", async () => {
    window.dashData = { accountId: "u1", prefs: { lastTeamId: "t2" } };
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("active").textContent).toBe("t2"));
  });

  it("неизвестная группа в настройках: эвристика, как раньше", async () => {
    window.dashData = { accountId: "u1", prefs: { lastTeamId: "gone" } };
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("active").textContent).toBe("t1"));
  });

  it("выбор группы пишет lastTeamId в настройки", async () => {
    window.dashData = { accountId: "u1", prefs: {} };
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("active").textContent).toBe("t1"));
    await act(async () => { screen.getByText("t2").click(); });
    expect(screen.getByTestId("active").textContent).toBe("t2");
    flushPrefs();
    expect(api.account.updatePrefs).toHaveBeenCalledWith({ lastTeamId: "t2" });
  });
});
