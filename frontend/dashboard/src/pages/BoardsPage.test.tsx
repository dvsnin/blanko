import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { api } from "../api/client";
import { flushPrefs } from "../utils/prefs";
import BoardsPage from "./BoardsPage";
import { TeamsContext, DEFAULT_BOARD_QUERY, type TeamsContextValue } from "../contexts/TeamsContext";
import { UserContext, type UserContextValue } from "../contexts/UserContext";
import type { Board, Team } from "../types";

vi.mock("../api/client", () => ({ api: { account: { updatePrefs: vi.fn().mockResolvedValue({}) } } }));

const board = (i: number, teamId = "t1"): Board => ({
  id: `b${i}`, publicId: `p${i}`, title: `Доска ${i}`, owner: "Анна П.", ownerId: "u1", lastOpened: "",
  updatedAt: "2026-10-20T10:00:00Z", lastOpenedAt: "2026-10-20T10:00:00Z", canEdit: true, templateId: undefined, ...(teamId ? {} : {}),
});
const team: Team = { id: "t1", name: "Ромашка", role: "owner", recentBoards: [], boardCount: 30, isStarred: false, memberBoardAccess: "view" };
const other: Team = { id: "t2", name: "Солнышко", role: "member", recentBoards: [], boardCount: 1, isStarred: false };

function fake(over: Partial<TeamsContextValue> = {}): TeamsContextValue {
  const items = Array.from({ length: 24 }, (_, i) => board(i + 1));
  return {
    teams: [team, other], activeTeamId: "t1", activeTeam: team, activeBoards: items,
    boardList: { items, total: 30, hasMore: true, loading: false },
    boardQuery: DEFAULT_BOARD_QUERY, setBoardQuery: vi.fn(), loadMoreBoards: vi.fn().mockResolvedValue(undefined), otherMatches: [],
    loading: false, error: null,
    setActiveTeamId: vi.fn(), createTeam: vi.fn(), updateTeam: vi.fn(), deleteTeam: vi.fn(), leaveTeam: vi.fn(), toggleStarTeam: vi.fn(),
    createBoard: vi.fn(), renameBoard: vi.fn(), deleteBoard: vi.fn(), duplicateBoard: vi.fn(), moveBoard: vi.fn(), updateBoardAccess: vi.fn(),
    toggleStarBoard: vi.fn(), markBoardOpened: vi.fn(), refresh: vi.fn(),
    ...over,
  };
}

const user = { user: { id: "u1", name: "Анна", email: "a@x.ru" }, setUser: vi.fn(), updateName: vi.fn(), userInitial: "А", workspaceName: "Сад" } as unknown as UserContextValue;

function setup(value: TeamsContextValue, prefs: Record<string, string> = {}) {
  window.dashData = { accountId: "u1", hasTeams: true, hasBoards: true, prefs };
  return render(
    <UserContext.Provider value={user}>
      <TeamsContext.Provider value={value}><BoardsPage /></TeamsContext.Provider>
    </UserContext.Provider>,
  );
}

// Список приходит страницами: страница показывает загруженное, счётчик фильтра и кнопку «ещё»,
// а сегмент, сортировка и поиск уходят в контекст запросом к серверу.
describe("BoardsPage: страницы досок", () => {
  afterEach(() => { cleanup(); delete window.dashData; });

  it("показывает загруженные доски, total и «Показать ещё», клик дозагружает", () => {
    const v = fake();
    setup(v);
    expect(document.querySelectorAll("[data-board-id]")).toHaveLength(24);
    expect(screen.getByText("30", { selector: ".chip" })).toBeTruthy();
    expect(screen.getByText("Показано 24 из 30")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(v.loadMoreBoards).toHaveBeenCalledTimes(1);
  });

  it("без следующей страницы кнопки нет", () => {
    const items = [board(1), board(2)];
    setup(fake({ activeBoards: items, boardList: { items, total: 2, hasMore: false, loading: false } }));
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
    expect(screen.queryByText(/Показано/)).toBeNull();
  });

  it("сегмент и поиск меняют запрос списка, а не фильтруют на клиенте", () => {
    const v = fake();
    setup(v);
    fireEvent.click(screen.getByRole("button", { name: "Мои" }));
    expect(v.setBoardQuery).toHaveBeenLastCalledWith({ segment: "mine", sort: "recent", q: "" });
    fireEvent.change(screen.getByLabelText("Найти доску"), { target: { value: "счёт" } });
    expect(v.setBoardQuery).toHaveBeenLastCalledWith({ segment: "mine", sort: "recent", q: "счёт" });
    expect(document.querySelectorAll("[data-board-id]")).toHaveLength(24);
  });

  it("совпадения в других группах берутся из контекста", () => {
    setup(fake({ otherMatches: [{ board: board(99), team: other }] }));
    expect(screen.getByText("Ещё 1 в других группах")).toBeTruthy();
    expect(screen.getByText("Доска 99")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перейти в группу «Солнышко»" })).toBeTruthy();
  });

  it("пусто под фильтром: подсказка, а не «нет досок в группе»", () => {
    setup(fake({ activeBoards: [], boardList: { items: [], total: 0, hasMore: false, loading: false }, boardQuery: { segment: "starred", sort: "recent", q: "" } }));
    expect(screen.getByText("По выбранному фильтру досок нет. Создайте новую или снимите фильтр.")).toBeTruthy();
  });

  it("сегмент запоминается на аккаунте и читается при загрузке, как вид и сортировка", () => {
    const v = fake();
    setup(v, { "boards.segment": "starred" });
    expect(screen.getByRole("button", { name: "Избранные" }).getAttribute("aria-pressed")).toBe("true");
    expect(v.setBoardQuery).toHaveBeenLastCalledWith({ segment: "starred", sort: "recent", q: "" });
    fireEvent.click(screen.getByRole("button", { name: "Мои" }));
    flushPrefs();
    expect(api.account.updatePrefs).toHaveBeenCalledWith({ "boards.segment": "mine" });
  });

  it("диалог доступа: первая опция «Как в группе» с уровнем группы, у унаследованной доски она выбрана", () => {
    const items = [{ ...board(1), teamAccess: "view" as const, teamAccessInherited: true }];
    const v = fake({ activeBoards: items, boardList: { items, total: 1, hasMore: false, loading: false } });
    setup(v);
    fireEvent.click(screen.getByRole("button", { name: "Действия с доской" }));
    fireEvent.click(screen.getByRole("button", { name: /Доступ/ }));
    const select = screen.getByLabelText("Участники группы") as HTMLSelectElement;
    expect(select.value).toBe("inherit");
    expect(select.options[0].textContent).toBe("Как в группе: только смотрят");
    expect(screen.getByText(/Уровень задан в настройках группы/)).toBeTruthy();
    fireEvent.change(select, { target: { value: "edit" } });
    expect(v.updateBoardAccess).toHaveBeenCalledWith("b1", { teamAccess: "edit" });
  });
});
