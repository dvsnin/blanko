import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act, waitFor } from "@testing-library/react";
import { TeamsProvider, useTeams } from "./TeamsContext";
import { api } from "../api/client";
import { teamDTOs, firstBoard, boardDTO } from "./TeamsContext.boards.fixture";

vi.mock("../api/client", () => ({
  api: {
    teams: { list: vi.fn() },
    boards: { list: vi.fn(), duplicate: vi.fn(), move: vi.fn(), update: vi.fn() },
  },
}));

function Probe() {
  const { teams, duplicateBoard, moveBoard, updateBoardAccess } = useTeams();
  return (
    <div>
      {teams.map((t) => (
        <span key={t.id} data-testid={`team-${t.id}`}>{t.boards.map((b) => b.title).join("|")}</span>
      ))}
      <span data-testid="access">{teams.flatMap((t) => t.boards).map((b) => `${b.id}:${b.teamAccess}:${b.linkAccessEnabled}`).join(",")}</span>
      <button onClick={() => void duplicateBoard("b1")}>dup</button>
      <button onClick={() => void moveBoard("b1", "t2")}>move</button>
      <button onClick={() => void updateBoardAccess("b1", { teamAccess: "view", linkAccessEnabled: true })}>access</button>
    </div>
  );
}

// Кабинету нужны доски всех групп (последние доски и счётчики на «Группах»): один запрос
// /board/list без teamId вместо запроса на каждую группу.
describe("TeamsContext: загрузка досок", () => {
  beforeEach(() => {
    window.dashData = { accountId: "u1", name: "Анна", email: "a@x.ru" };
    vi.mocked(api.teams.list).mockResolvedValue(teamDTOs);
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.dashData; });

  it("один запрос на все доски, раскладка по группам", async () => {
    vi.mocked(api.boards.list).mockResolvedValue([firstBoard, boardDTO("b9", "t2", "Вторая")]);
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("team-t2").textContent).toBe("Вторая"));
    expect(screen.getByTestId("team-t1").textContent).toBe("Первая");
    expect(api.boards.list).toHaveBeenCalledTimes(1);
    expect(api.boards.list).toHaveBeenCalledWith();
  });
});

describe("TeamsContext: дублирование и перенос доски", () => {
  beforeEach(() => {
    window.dashData = { accountId: "u1", name: "Анна", email: "a@x.ru" };
    vi.mocked(api.teams.list).mockResolvedValue(teamDTOs);
    vi.mocked(api.boards.list).mockResolvedValue([firstBoard]);
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

  it("updateBoardAccess обновляет доступ доски из ответа сервера", async () => {
    vi.mocked(api.boards.update).mockResolvedValue({ ...boardDTO("b1", "t1", "Первая"), teamAccess: "view", linkAccessEnabled: true });
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("access").textContent).toBe("b1:edit:false"));

    await act(async () => { screen.getByText("access").click(); });

    expect(api.boards.update).toHaveBeenCalledWith("b1", { teamAccess: "view", linkAccessEnabled: true });
    expect(screen.getByTestId("access").textContent).toBe("b1:view:true");
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
