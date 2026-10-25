import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act, waitFor } from "@testing-library/react";
import { TeamsProvider, useTeams } from "./TeamsContext";
import { api } from "../api/client";
import { teamDTOs, firstBoard, boardDTO, page } from "./TeamsContext.boards.fixture";

vi.mock("../api/client", () => ({
  api: {
    teams: { list: vi.fn(), update: vi.fn() },
    boards: { list: vi.fn(), duplicate: vi.fn(), move: vi.fn(), update: vi.fn() },
  },
}));

const FIRST_PAGE = { teamId: "t1", segment: "all", sort: "recent", q: "", limit: 24 };

function Probe() {
  const { teams, activeBoards, boardList, loadMoreBoards, setBoardQuery, otherMatches, duplicateBoard, moveBoard, updateBoardAccess, updateTeam } = useTeams();
  return (
    <div>
      {teams.map((t) => (
        <span key={t.id} data-testid={`team-${t.id}`}>{t.boardCount}:{t.recentBoards.map((b) => b.title).join("|")}</span>
      ))}
      <span data-testid="list">{activeBoards.map((b) => b.title).join("|")}</span>
      <span data-testid="meta">{boardList.total}:{String(boardList.hasMore)}</span>
      <span data-testid="access">{activeBoards.map((b) => `${b.id}:${b.teamAccess}:${b.linkAccessEnabled}${b.teamAccessInherited ? ":inherited" : ""}`).join(",")}</span>
      <span data-testid="team-access">{teams.map((t) => `${t.id}:${t.memberBoardAccess ?? "-"}`).join(",")}</span>
      <span data-testid="others">{otherMatches.map((m) => `${m.board.title}@${m.team.name}`).join("|")}</span>
      <button onClick={() => void duplicateBoard("b1")}>dup</button>
      <button onClick={() => void moveBoard("b1", "t2")}>move</button>
      <button onClick={() => void updateBoardAccess("b1", { teamAccess: "view", linkAccessEnabled: true })}>access</button>
      <button onClick={() => void updateBoardAccess("b1", { teamAccess: "inherit" })}>inherit</button>
      <button onClick={() => void updateTeam("t1", { memberBoardAccess: "view" })}>team-view</button>
      <button onClick={() => void loadMoreBoards()}>more</button>
      <button onClick={() => setBoardQuery({ segment: "mine", sort: "name", q: "" })}>mine</button>
      <button onClick={() => setBoardQuery({ segment: "all", sort: "recent", q: "пер" })}>search</button>
    </div>
  );
}

function setup() {
  window.dashData = { accountId: "u1", name: "Анна", email: "a@x.ru" };
  vi.mocked(api.teams.list).mockResolvedValue(teamDTOs);
  vi.mocked(api.boards.list).mockResolvedValue(page([firstBoard]));
}
afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.dashData; });

// Доски приходят страницами только для активной группы; «Группы» и переключатель
// живут на recentBoards и boardCount из /team/list.
describe("TeamsContext: страницы досок активной группы", () => {
  beforeEach(setup);

  it("первая страница: один запрос с teamId, total и признак «есть ещё»", async () => {
    vi.mocked(api.boards.list).mockResolvedValue(page([firstBoard], 2, "c1"));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая"));
    expect(screen.getByTestId("meta").textContent).toBe("2:true");
    expect(screen.getByTestId("team-t1").textContent).toBe("1:Первая");
    expect(api.boards.list).toHaveBeenCalledTimes(1);
    expect(api.boards.list).toHaveBeenCalledWith(FIRST_PAGE);
  });

  it("«Показать ещё» запрашивает с курсором и дописывает в конец", async () => {
    vi.mocked(api.boards.list)
      .mockResolvedValueOnce(page([firstBoard], 2, "c1"))
      .mockResolvedValueOnce(page([boardDTO("b2", "t1", "Вторая")], 2, ""));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая"));
    await act(async () => { screen.getByText("more").click(); });
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая|Вторая"));
    expect(screen.getByTestId("meta").textContent).toBe("2:false");
    expect(api.boards.list).toHaveBeenLastCalledWith({ ...FIRST_PAGE, cursor: "c1" });
  });

  it("смена сегмента или сортировки грузит с первой страницы", async () => {
    vi.mocked(api.boards.list)
      .mockResolvedValueOnce(page([firstBoard], 1))
      .mockResolvedValueOnce(page([boardDTO("b3", "t1", "Моя")], 1));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая"));
    await act(async () => { screen.getByText("mine").click(); });
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Моя"));
    expect(api.boards.list).toHaveBeenLastCalledWith({ ...FIRST_PAGE, segment: "mine", sort: "name" });
  });

  it("поиск: страница группы по запросу плюс совпадения в других группах", async () => {
    vi.mocked(api.boards.list).mockImplementation(async (params) => {
      if (params.excludeTeamId) return page([boardDTO("b9", "t2", "Перелётные птицы")]);
      return page(params.q ? [firstBoard] : [firstBoard]);
    });
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая"));
    await act(async () => { screen.getByText("search").click(); });
    await waitFor(() => expect(screen.getByTestId("others").textContent).toBe("Перелётные птицы@Ромашка"));
    expect(api.boards.list).toHaveBeenCalledWith({ ...FIRST_PAGE, q: "пер" });
    expect(api.boards.list).toHaveBeenCalledWith({ q: "пер", excludeTeamId: "t1", limit: 10 });
  });
});

describe("TeamsContext: мутации правят страницу и карточки групп", () => {
  beforeEach(setup);

  it("duplicateBoard добавляет копию в начало списка и в последние доски группы", async () => {
    vi.mocked(api.boards.duplicate).mockResolvedValue(boardDTO("b2", "t1", "Первая (копия)"));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая"));
    await act(async () => { screen.getByText("dup").click(); });
    expect(api.boards.duplicate).toHaveBeenCalledWith("b1");
    expect(screen.getByTestId("list").textContent).toBe("Первая (копия)|Первая");
    expect(screen.getByTestId("team-t1").textContent).toBe("2:Первая (копия)|Первая");
    expect(screen.getByTestId("meta").textContent).toBe("2:false");
  });

  it("updateBoardAccess обновляет доступ доски из ответа сервера", async () => {
    vi.mocked(api.boards.update).mockResolvedValue({ ...boardDTO("b1", "t1", "Первая"), teamAccess: "view", teamAccessInherited: false, linkAccessEnabled: true });
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("access").textContent).toBe("b1:edit:false:inherited"));
    await act(async () => { screen.getByText("access").click(); });
    expect(api.boards.update).toHaveBeenCalledWith("b1", { teamAccess: "view", linkAccessEnabled: true });
    expect(screen.getByTestId("access").textContent).toBe("b1:view:true");
  });

  it("уровень доступа группы: действует на доски без своей настройки, своя настройка переопределяет, «как в группе» возвращает", async () => {
    vi.mocked(api.boards.list).mockResolvedValue(page([{ ...firstBoard, teamAccessInherited: true }, { ...boardDTO("b2", "t1", "Своя"), teamAccess: "deny", teamAccessInherited: false }]));
    vi.mocked(api.teams.update).mockResolvedValue({ ...teamDTOs[0], memberBoardAccess: "view" });
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("access").textContent).toBe("b1:edit:false:inherited,b2:deny:false"));
    expect(screen.getByTestId("team-access").textContent).toBe("t1:edit,t2:edit");

    await act(async () => { screen.getByText("team-view").click(); });
    expect(api.teams.update).toHaveBeenCalledWith("t1", { memberBoardAccess: "view" });
    expect(screen.getByTestId("team-access").textContent).toBe("t1:view,t2:edit");
    expect(screen.getByTestId("access").textContent).toBe("b1:view:false:inherited,b2:deny:false");

    vi.mocked(api.boards.update).mockResolvedValue({ ...firstBoard, teamAccess: "view", teamAccessInherited: true });
    await act(async () => { screen.getByText("inherit").click(); });
    expect(api.boards.update).toHaveBeenCalledWith("b1", { teamAccess: "inherit" });
  });

  it("moveBoard убирает доску из списка и переносит её в последние доски целевой группы", async () => {
    vi.mocked(api.boards.move).mockResolvedValue(boardDTO("b1", "t2", "Первая"));
    render(<TeamsProvider><Probe /></TeamsProvider>);
    await waitFor(() => expect(screen.getByTestId("list").textContent).toBe("Первая"));
    await act(async () => { screen.getByText("move").click(); });
    expect(api.boards.move).toHaveBeenCalledWith("b1", "t2");
    expect(screen.getByTestId("list").textContent).toBe("");
    expect(screen.getByTestId("team-t1").textContent).toBe("0:");
    expect(screen.getByTestId("team-t2").textContent).toBe("1:Первая");
  });
});
