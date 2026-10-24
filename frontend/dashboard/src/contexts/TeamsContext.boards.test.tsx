import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act, waitFor } from "@testing-library/react";
import { TeamsProvider, useTeams } from "./TeamsContext";
import { api } from "../api/client";
import { teamDTOs, firstBoard, boardDTO } from "./TeamsContext.boards.fixture";

vi.mock("../api/client", () => ({
  api: {
    teams: { list: vi.fn() },
    boards: { listByTeam: vi.fn(), duplicate: vi.fn(), move: vi.fn() },
  },
}));

function Probe() {
  const { teams, duplicateBoard, moveBoard } = useTeams();
  return (
    <div>
      {teams.map((t) => (
        <span key={t.id} data-testid={`team-${t.id}`}>{t.boards.map((b) => b.title).join("|")}</span>
      ))}
      <button onClick={() => void duplicateBoard("b1")}>dup</button>
      <button onClick={() => void moveBoard("b1", "t2")}>move</button>
    </div>
  );
}

describe("TeamsContext: дублирование и перенос доски", () => {
  beforeEach(() => {
    window.dashData = { accountId: "u1", name: "Анна", email: "a@x.ru" };
    vi.mocked(api.teams.list).mockResolvedValue(teamDTOs);
    vi.mocked(api.boards.listByTeam).mockImplementation(async (teamId: string) => (teamId === "t1" ? [firstBoard] : []));
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.dashData; });

  it("duplicateBoard добавляет копию в начало списка группы доски", async () => {
    vi.mocked(api.boards.duplicate).mockResolvedValue(boardDTO("b2", "t1", "Первая (копия)"));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("team-t1").textContent).toBe("Первая"));

    await act(async () => { screen.getByText("dup").click(); });

    expect(api.boards.duplicate).toHaveBeenCalledWith("b1");
    expect(screen.getByTestId("team-t1").textContent).toBe("Первая (копия)|Первая");
  });

  it("moveBoard убирает доску из исходной группы и добавляет в целевую", async () => {
    vi.mocked(api.boards.move).mockResolvedValue(boardDTO("b1", "t2", "Первая"));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("team-t1").textContent).toBe("Первая"));

    await act(async () => { screen.getByText("move").click(); });

    expect(api.boards.move).toHaveBeenCalledWith("b1", "t2");
    expect(screen.getByTestId("team-t1").textContent).toBe("");
    expect(screen.getByTestId("team-t2").textContent).toBe("Первая");
  });
});
