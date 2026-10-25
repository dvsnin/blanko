import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { BoardAccess, Team, Board } from "../types";
import type { AgeKey } from "../constants/templates";
import { colorForId } from "../utils/cover";
import { assignColors } from "../utils/colors";
import { formatLastOpened, formatRelative } from "../utils/relativeTime";
import { api, ApiError, type BoardDTO, type BoardSegment, type BoardSort, type TeamDTO } from "../api/client";
import { readPref, readPrefIn, savePrefs } from "../utils/prefs";

// Группы и доски кабинета: /team/list даёт группы со счётчиками и последними досками, /board/list
// отдаёт доски активной группы страницами под текущий запрос; правки применяются оптимистично.

export interface BoardQuery {
  segment: BoardSegment;
  sort: BoardSort;
  q: string;
}

export interface BoardList {
  /** Загруженные страницы подряд. */
  items: Board[];
  /** Всего досок под текущим запросом. */
  total: number;
  hasMore: boolean;
  loading: boolean;
}

export interface OtherMatch {
  board: Board;
  team: Team;
}

export interface TeamsContextValue {
  teams: Team[];
  activeTeamId: string | null;
  activeTeam: Team | null;
  /** Доски активной группы, загруженные страницами (= boardList.items). */
  activeBoards: Board[];
  boardList: BoardList;
  boardQuery: BoardQuery;
  /** Меняет сегмент, сортировку или поиск: список грузится заново с первой страницы. */
  setBoardQuery: (query: BoardQuery) => void;
  loadMoreBoards: () => Promise<void>;
  /** Совпадения поиска в других группах (пусто без запроса). */
  otherMatches: OtherMatch[];

  loading: boolean;
  error: string | null;

  setActiveTeamId: (id: string | null) => void;
  createTeam: (opts: { name: string; ageGroup?: AgeKey; teachers?: string }) => Promise<void>;
  updateTeam: (teamId: string, patch: { name?: string; ageGroup?: AgeKey | ""; teachers?: string; memberBoardAccess?: BoardAccess }) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  leaveTeam: (teamId: string) => Promise<void>;
  toggleStarTeam: (teamId: string) => Promise<void>;
  createBoard: (title?: string, templateId?: string) => Promise<Board | null>;
  renameBoard: (boardId: string, newTitle: string) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  /** Копия доски вместе с содержимым в той же группе; null при ошибке. */
  duplicateBoard: (boardId: string) => Promise<Board | null>;
  /** Перенос доски в другую группу пользователя. */
  moveBoard: (boardId: string, teamId: string) => Promise<void>;
  /** Доступ участников группы к содержимому ("inherit" - как в группе) и доступ по ссылке. */
  updateBoardAccess: (boardId: string, patch: { teamAccess?: BoardAccess | "inherit"; linkAccessEnabled?: boolean }) => Promise<void>;
  toggleStarBoard: (boardId: string) => Promise<void>;
  /** Показ на экране: hours часов (0 - пока не выключат) или null - выключить. */
  setPresent: (boardId: string, hours: number | null) => Promise<void>;
  /** Оптимистично помечает доску открытой сейчас (сервер сам обновляет при открытии). */
  markBoardOpened: (boardId: string) => void;
  refresh: () => Promise<void>;
}

export const TeamsContext = createContext<TeamsContextValue | null>(null);

interface TeamsProviderProps {
  children: ReactNode;
}

export function boardFromDTO(dto: BoardDTO, colorKey: string = colorForId(dto.id)): Board {
  return {
    id: dto.id,
    publicId: dto.publicId,
    title: dto.name,
    owner: dto.ownerName,
    ownerId: dto.ownerId,
    lastOpened: formatLastOpened(dto.lastOpenedAt || dto.updatedAt),
    updated: formatRelative(dto.updatedAt),
    updatedAt: dto.updatedAt,
    lastOpenedAt: dto.lastOpenedAt || dto.updatedAt,
    createdAt: dto.createdAt,
    colorKey,
    isStarred: dto.isStarred,
    canEdit: dto.canEdit,
    teamAccess: dto.teamAccess,
    teamAccessInherited: dto.teamAccessInherited,
    linkAccessEnabled: dto.linkAccessEnabled,
    presentEnabled: dto.presentEnabled,
    presentToken: dto.presentToken || undefined,
    presentExpiresAt: dto.presentExpiresAt || undefined,
    presenterId: dto.presenterId || undefined,
    presenterName: dto.presenterName || undefined,
    templateId: dto.templateId || undefined,
  };
}

export function teamFromDTO(dto: TeamDTO): Team {
  return {
    id: dto.id,
    name: dto.name,
    role: dto.role,
    recentBoards: mapBoards(dto.recentBoards ?? []),
    boardCount: dto.boardCount ?? 0,
    isStarred: dto.isStarred,
    ageGroup: (dto.ageGroup || undefined) as AgeKey | undefined,
    teachers: dto.teachers || undefined,
    memberBoardAccess: dto.memberBoardAccess || undefined,
  };
}

/** Маппит список досок в модель фронта; цвет всегда выводится из id доски. */
export function mapBoards(dtos: BoardDTO[]): Board[] {
  return dtos.map((dto) => boardFromDTO(dto));
}

/** Сколько последних досок держит карточка группы. */
export const TEAM_RECENT_BOARDS = 3;
/** Размер страницы списка досок. */
export const BOARD_PAGE_SIZE = 24;
/** Сколько совпадений из других групп показывает поиск. */
export const OTHER_MATCHES_LIMIT = 10;
/** Пауза после ввода в поиске перед запросом к серверу. */
export const BOARD_QUERY_DEBOUNCE_MS = 250;

export const DEFAULT_BOARD_QUERY: BoardQuery = { segment: "all", sort: "recent", q: "" };

const EMPTY_LIST: BoardList = { items: [], total: 0, hasMore: false, loading: false };

// Сначала группа из настроек аккаунта (переживает перезагрузку и смену устройства),
// иначе первая с досками, иначе первая.
function pickInitialActiveTeamId(teams: Team[]): string | null {
  const saved = readPref("lastTeamId");
  if (typeof saved === "string" && teams.some((t) => t.id === saved)) return saved;
  const withBoards = teams.find((t) => t.boardCount > 0);
  return withBoards?.id ?? teams[0]?.id ?? null;
}

const byRecent = (a: Board, b: Board) => Date.parse(b.lastOpenedAt ?? "") - Date.parse(a.lastOpenedAt ?? "");

/** Кладёт доску в последние доски группы, держа их отсортированными и не длиннее лимита. */
function withRecent(team: Team, board: Board): Team {
  const rest = team.recentBoards.filter((b) => b.id !== board.id);
  return { ...team, recentBoards: [board, ...rest].sort(byRecent).slice(0, TEAM_RECENT_BOARDS) };
}

/** Группа, в чьих последних досках есть доска; для доски со страницы это активная группа. */
function teamOfBoard(teams: Team[], boardId: string): string | undefined {
  return teams.find((t) => t.recentBoards.some((b) => b.id === boardId))?.id;
}

export function TeamsProvider({ children }: TeamsProviderProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  // Явный выбор пользователя запоминаем на аккаунте; внутренние переключения (удаление группы) - нет.
  const selectTeam = useCallback((id: string | null) => {
    setActiveTeamId(id);
    if (id) savePrefs({ lastTeamId: id });
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Сегмент и сортировка стартуют из настроек аккаунта, как и на странице досок: иначе первая
  // страница грузилась бы дважды (по умолчанию и после применения настроек).
  const [boardQuery, setBoardQueryState] = useState<BoardQuery>(() => ({
    segment: readPrefIn("boards.segment", ["all", "mine", "starred"], DEFAULT_BOARD_QUERY.segment),
    sort: readPrefIn("boards.sort", ["recent", "updated", "name"], DEFAULT_BOARD_QUERY.sort),
    q: "",
  }));
  const [boardList, setBoardList] = useState<BoardList>(EMPTY_LIST);
  const [otherMatches, setOtherMatches] = useState<OtherMatch[]>([]);
  // Курсор следующей страницы и номер последнего запроса: ответы на устаревшие запросы отбрасываем.
  const nextCursorRef = useRef("");
  const requestSeq = useRef(0);
  const boardListRef = useRef(boardList);
  useEffect(() => { boardListRef.current = boardList; }, [boardList]);
  const teamsRef = useRef<Team[]>([]);
  useEffect(() => { teamsRef.current = teams; }, [teams]);

  const refreshTeams = useCallback(async () => {
    const teamDTOs = await api.teams.list();
    const next = teamDTOs.map(teamFromDTO);
    teamsRef.current = next;
    setTeams(next);
    setActiveTeamId((current) => {
      if (current && next.some((t) => t.id === current)) return current;
      return pickInitialActiveTeamId(next);
    });
  }, []);

  /** Первая страница списка под текущие группу и запрос. */
  const loadFirstPage = useCallback(async (teamId: string | null, query: BoardQuery) => {
    const seq = ++requestSeq.current;
    if (!teamId) {
      nextCursorRef.current = "";
      setBoardList(EMPTY_LIST);
      setOtherMatches([]);
      return;
    }
    setBoardList((prev) => ({ ...prev, loading: true }));
    const q = query.q.trim();
    try {
      const [page, others] = await Promise.all([
        api.boards.list({ teamId, segment: query.segment, sort: query.sort, q, limit: BOARD_PAGE_SIZE }),
        q ? api.boards.list({ q, excludeTeamId: teamId, limit: OTHER_MATCHES_LIMIT }) : Promise.resolve(null),
      ]);
      if (seq !== requestSeq.current) return;
      nextCursorRef.current = page.nextCursor;
      setBoardList({ items: mapBoards(page.items), total: page.total, hasMore: page.nextCursor !== "", loading: false });
      const teamById = new Map(teamsRef.current.map((t) => [t.id, t]));
      setOtherMatches(
        others
          ? others.items.flatMap((dto) => {
              const team = teamById.get(dto.teamId);
              return team ? [{ board: boardFromDTO(dto), team }] : [];
            })
          : [],
      );
    } catch (e) {
      if (seq !== requestSeq.current) return;
      console.error("load boards failed:", e);
      setBoardList((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const loadMoreBoards = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!activeTeamId || !cursor || boardListRef.current.loading) return;
    const seq = requestSeq.current;
    setBoardList((prev) => ({ ...prev, loading: true }));
    try {
      const page = await api.boards.list({
        teamId: activeTeamId, segment: boardQuery.segment, sort: boardQuery.sort, q: boardQuery.q.trim(), limit: BOARD_PAGE_SIZE, cursor,
      });
      if (seq !== requestSeq.current) return;
      nextCursorRef.current = page.nextCursor;
      setBoardList((prev) => {
        const known = new Set(prev.items.map((b) => b.id));
        const fresh = mapBoards(page.items).filter((b) => !known.has(b.id));
        return { items: [...prev.items, ...fresh], total: page.total, hasMore: page.nextCursor !== "", loading: false };
      });
    } catch (e) {
      if (seq !== requestSeq.current) return;
      console.error("load more boards failed:", e);
      setBoardList((prev) => ({ ...prev, loading: false }));
    }
  }, [activeTeamId, boardQuery]);

  const setBoardQuery = useCallback((query: BoardQuery) => {
    setBoardQueryState((prev) =>
      prev.segment === query.segment && prev.sort === query.sort && prev.q === query.q ? prev : query,
    );
  }, []);

  // Смена группы, сегмента и сортировки грузит сразу; набор текста в поиске - с паузой.
  const lastQ = useRef("");
  useEffect(() => {
    const typing = boardQuery.q !== lastQ.current;
    lastQ.current = boardQuery.q;
    if (!typing) {
      void loadFirstPage(activeTeamId, boardQuery);
      return;
    }
    const id = setTimeout(() => void loadFirstPage(activeTeamId, boardQuery), BOARD_QUERY_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [activeTeamId, boardQuery, loadFirstPage]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshTeams();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      console.error("load teams failed:", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [refreshTeams]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Вернулись на вкладку кабинета: превью и «изменено» могли устареть, пока рисовали в другой.
  const refreshAll = useCallback(async () => {
    await refresh();
    await loadFirstPage(activeTeamId, boardQuery);
  }, [refresh, loadFirstPage, activeTeamId, boardQuery]);
  useVisibleRefresh(refreshAll);

  // Цвета групп без повторов, как у досок внутри группы
  const coloredTeams = useMemo(() => assignColors(teams), [teams]);
  const activeTeam = useMemo(
    () => (activeTeamId ? coloredTeams.find((t) => t.id === activeTeamId) ?? null : null),
    [coloredTeams, activeTeamId],
  );

  // Локальные правки страницы списка и последних досок групп.

  const patchBoard = useCallback((boardId: string, fn: (b: Board) => Board) => {
    setBoardList((prev) => ({ ...prev, items: prev.items.map((b) => (b.id === boardId ? fn(b) : b)) }));
    setTeams((prev) => prev.map((t) => ({ ...t, recentBoards: t.recentBoards.map((b) => (b.id === boardId ? fn(b) : b)) })));
  }, []);

  const findBoard = useCallback((boardId: string): Board | undefined => {
    const inList = boardListRef.current.items.find((b) => b.id === boardId);
    if (inList) return inList;
    for (const t of teamsRef.current) {
      const b = t.recentBoards.find((x) => x.id === boardId);
      if (b) return b;
    }
    return undefined;
  }, []);

  /** Новая доска группы teamId: в начало страницы (если она открыта), в последние доски, в счётчик. */
  const addBoard = useCallback((board: Board, teamId: string) => {
    if (teamId === activeTeamId) {
      setBoardList((prev) => ({ ...prev, items: [board, ...prev.items.filter((b) => b.id !== board.id)], total: prev.total + 1 }));
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...withRecent(t, board), boardCount: t.boardCount + 1 } : t)));
  }, [activeTeamId]);

  /** Доска ушла из группы teamId (удалена или перенесена): со страницы, из последних, из счётчика. */
  const removeBoard = useCallback((boardId: string, teamId: string | undefined) => {
    setBoardList((prev) => {
      if (!prev.items.some((b) => b.id === boardId)) return prev;
      return { ...prev, items: prev.items.filter((b) => b.id !== boardId), total: Math.max(0, prev.total - 1) };
    });
    setTeams((prev) =>
      prev.map((t) => {
        const had = t.recentBoards.some((b) => b.id === boardId);
        if (t.id !== teamId && !had) return t;
        return {
          ...t,
          recentBoards: t.recentBoards.filter((b) => b.id !== boardId),
          boardCount: t.id === teamId ? Math.max(0, t.boardCount - 1) : t.boardCount,
        };
      }),
    );
  }, []);

  const createTeam = useCallback(async ({ name, ageGroup, teachers }: { name: string; ageGroup?: AgeKey; teachers?: string }) => {
    try {
      const created = await api.teams.create(name, ageGroup, teachers);
      const team = teamFromDTO(created);
      setTeams((prev) => [team, ...prev]);
      selectTeam(team.id);
    } catch (e) {
      console.error("createTeam failed:", e);
      throw e;
    }
  }, [selectTeam]);

  const updateTeam = useCallback(
    async (teamId: string, patch: { name?: string; ageGroup?: AgeKey | ""; teachers?: string; memberBoardAccess?: BoardAccess }) => {
    try {
      const updated = await api.teams.update(teamId, patch);
      const access = updated.memberBoardAccess || undefined;
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                name: updated.name,
                ageGroup: (updated.ageGroup || undefined) as AgeKey | undefined,
                teachers: updated.teachers || undefined,
                memberBoardAccess: access,
                recentBoards: t.recentBoards.map((b) => (b.teamAccessInherited && access ? { ...b, teamAccess: access } : b)),
              }
            : t,
        ),
      );
      // Доски без своей настройки сразу показывают новый уровень группы.
      if (access && teamId === activeTeamId) {
        setBoardList((prev) => ({ ...prev, items: prev.items.map((b) => (b.teamAccessInherited ? { ...b, teamAccess: access } : b)) }));
      }
    } catch (e) {
      console.error("updateTeam failed:", e);
      throw e;
    }
    },
    [activeTeamId],
  );

  const deleteTeam = useCallback(async (teamId: string) => {
    try {
      await api.teams.delete(teamId);
      setTeams((prev) => {
        const remaining = prev.filter((t) => t.id !== teamId);
        setActiveTeamId((current) =>
          current === teamId ? remaining[0]?.id ?? null : current,
        );
        return remaining;
      });
    } catch (e) {
      console.error("deleteTeam failed:", e);
      throw e;
    }
  }, []);

  const leaveTeam = useCallback(async (teamId: string) => {
    try {
      await api.teams.leave(teamId);
      setTeams((prev) => {
        const remaining = prev.filter((t) => t.id !== teamId);
        setActiveTeamId((current) =>
          current === teamId ? remaining[0]?.id ?? null : current,
        );
        return remaining;
      });
    } catch (e) {
      console.error("leaveTeam failed:", e);
      throw e;
    }
  }, []);

  const toggleStarTeam = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;
      const nextStarred = !team.isStarred;
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, isStarred: nextStarred } : t)),
      );
      try {
        if (nextStarred) await api.teams.star(teamId);
        else await api.teams.unstar(teamId);
      } catch (e) {
        console.error("toggleStarTeam failed:", e);
        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, isStarred: !nextStarred } : t)),
        );
      }
    },
    [teams],
  );

  const createBoard = useCallback(
    async (title = "Новая доска", templateId?: string): Promise<Board | null> => {
      if (!activeTeamId) return null;
      try {
        const created = await api.boards.create(activeTeamId, title, templateId);
        const board = boardFromDTO(created);
        addBoard(board, created.teamId);
        return board;
      } catch (e) {
        console.error("createBoard failed:", e);
        return null;
      }
    },
    [activeTeamId, addBoard],
  );

  const renameBoard = useCallback(
    async (boardId: string, newTitle: string) => {
      try {
        const updated = await api.boards.update(boardId, { name: newTitle });
        patchBoard(boardId, (b) => {
          const fresh = boardFromDTO(updated, b.colorKey);
          return { ...b, title: fresh.title, updated: fresh.updated, updatedAt: fresh.updatedAt, lastOpened: fresh.lastOpened };
        });
      } catch (e) {
        console.error("renameBoard failed:", e);
        throw e;
      }
    },
    [patchBoard],
  );

  const deleteBoard = useCallback(async (boardId: string) => {
    try {
      await api.boards.delete(boardId);
      removeBoard(boardId, teamOfBoard(teamsRef.current, boardId) ?? activeTeamId ?? undefined);
    } catch (e) {
      console.error("deleteBoard failed:", e);
      throw e;
    }
  }, [activeTeamId, removeBoard]);

  const duplicateBoard = useCallback(async (boardId: string): Promise<Board | null> => {
    try {
      const created = await api.boards.duplicate(boardId);
      const board = boardFromDTO(created);
      addBoard(board, created.teamId);
      return board;
    } catch (e) {
      console.error("duplicateBoard failed:", e);
      return null;
    }
  }, [addBoard]);

  const moveBoard = useCallback(async (boardId: string, teamId: string) => {
    try {
      const moved = await api.boards.move(boardId, teamId);
      const existing = findBoard(boardId);
      const board = existing ? { ...existing, updatedAt: moved.updatedAt } : boardFromDTO(moved);
      removeBoard(boardId, teamOfBoard(teamsRef.current, boardId) ?? activeTeamId ?? undefined);
      addBoard(board, moved.teamId);
    } catch (e) {
      console.error("moveBoard failed:", e);
      throw e;
    }
  }, [activeTeamId, findBoard, removeBoard, addBoard]);

  const updateBoardAccess = useCallback(async (boardId: string, patch: { teamAccess?: BoardAccess | "inherit"; linkAccessEnabled?: boolean }) => {
    try {
      const updated = await api.boards.update(boardId, patch);
      patchBoard(boardId, (b) => ({ ...b, teamAccess: updated.teamAccess, teamAccessInherited: updated.teamAccessInherited, linkAccessEnabled: updated.linkAccessEnabled }));
    } catch (e) {
      console.error("updateBoardAccess failed:", e);
      throw e;
    }
  }, [patchBoard]);

  const toggleStarBoard = useCallback(async (boardId: string) => {
    // Читаем актуальное состояние из ref, а не из замыкания: updater setState выполняется позже.
    const nextStarred = !findBoard(boardId)?.isStarred;
    patchBoard(boardId, (b) => ({ ...b, isStarred: nextStarred }));
    try {
      if (nextStarred) await api.boards.star(boardId);
      else await api.boards.unstar(boardId);
    } catch (e) {
      console.error("toggleStarBoard failed:", e);
      patchBoard(boardId, (b) => ({ ...b, isStarred: !nextStarred }));
    }
  }, [findBoard, patchBoard]);

  const setPresent = useCallback(async (boardId: string, hours: number | null) => {
    try {
      const updated = hours === null ? await api.boards.presentDisable(boardId) : await api.boards.presentEnable(boardId, hours);
      const fresh = boardFromDTO(updated);
      patchBoard(boardId, (b) => ({
        ...b, presentEnabled: fresh.presentEnabled, presentToken: fresh.presentToken,
        presentExpiresAt: fresh.presentExpiresAt, presenterId: fresh.presenterId, presenterName: fresh.presenterName,
      }));
    } catch (e) {
      console.error("setPresent failed:", e);
      throw e;
    }
  }, [patchBoard]);

  const markBoardOpened = useCallback((boardId: string) => {
    const now = new Date().toISOString();
    patchBoard(boardId, (b) => ({ ...b, lastOpenedAt: now, lastOpened: formatLastOpened(now) }));
  }, [patchBoard]);

  const value = useMemo<TeamsContextValue>(
    () => ({
      teams: coloredTeams,
      activeTeamId,
      activeTeam,
      activeBoards: boardList.items,
      boardList,
      boardQuery,
      setBoardQuery,
      loadMoreBoards,
      otherMatches,
      loading,
      error,
      setActiveTeamId: selectTeam,
      createTeam,
      updateTeam,
      deleteTeam,
      leaveTeam,
      toggleStarTeam,
      createBoard,
      renameBoard,
      deleteBoard,
      duplicateBoard,
      moveBoard,
      updateBoardAccess,
      toggleStarBoard,
      setPresent,
      markBoardOpened,
      refresh: refreshAll,
    }),
    [
      coloredTeams,
      activeTeamId,
      activeTeam,
      boardList,
      boardQuery,
      setBoardQuery,
      loadMoreBoards,
      otherMatches,
      loading,
      error,
      selectTeam,
      createTeam,
      updateTeam,
      deleteTeam,
      leaveTeam,
      toggleStarTeam,
      createBoard,
      renameBoard,
      deleteBoard,
      duplicateBoard,
      moveBoard,
      updateBoardAccess,
      toggleStarBoard,
      setPresent,
      markBoardOpened,
      refreshAll,
    ],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams(): TeamsContextValue {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used within TeamsProvider");
  return ctx;
}

/** Период, чаще которого возврат на вкладку списки не перечитывает. */
export const VISIBLE_REFRESH_MIN_MS = 30_000;

/** Перечитывает данные, когда вкладка снова становится видимой, не чаще раза в VISIBLE_REFRESH_MIN_MS. */
export function useVisibleRefresh(refresh: () => Promise<void>) {
  const lastAt = useRef(Date.now());
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastAt.current < VISIBLE_REFRESH_MIN_MS) return;
      lastAt.current = Date.now();
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);
}
