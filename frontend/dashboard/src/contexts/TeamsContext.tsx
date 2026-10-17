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
import type { Team, Board } from "../types";
import type { AgeKey } from "../constants/templates";
import { colorForId } from "../utils/cover";
import { formatLastOpened, formatRelative } from "../utils/relativeTime";
import { api, ApiError, type BoardDTO, type TeamDTO } from "../api/client";

/**
 * TeamsContext — single source of truth for teams/boards, synchronised with
 * the backend over the REST API at /app/api/v1.
 *
 * Strategy:
 *  - On mount: fetch /team/list, then /board/list per team in parallel. dashData
 *    намеренно не содержит предзагруженных teams/boards — чтобы не дублировать
 *    контракт и не рассинхронизироваться с API.
 *  - All mutations hit the API; on success we update local state optimistically
 *    (or with the server response when it's more authoritative, e.g. create).
 *  - Errors are surfaced via the `error` field and logged.
 */

export interface TeamsContextValue {
  teams: Team[];
  activeTeamId: string | null;
  activeTeam: Team | null;
  activeBoards: Board[];

  loading: boolean;
  error: string | null;

  setActiveTeamId: (id: string | null) => void;
  createTeam: (opts: { name: string; ageGroup?: AgeKey }) => Promise<void>;
  updateTeam: (teamId: string, patch: { name?: string; ageGroup?: AgeKey | "" }) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  leaveTeam: (teamId: string) => Promise<void>;
  toggleStarTeam: (teamId: string) => Promise<void>;
  createBoard: (title?: string, templateId?: string) => Promise<Board | null>;
  renameBoard: (boardId: string, newTitle: string) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  toggleStarBoard: (boardId: string) => Promise<void>;
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
    lastOpened: formatLastOpened(dto.updatedAt),
    updated: formatRelative(dto.updatedAt),
    updatedAt: dto.updatedAt,
    colorKey,
    isStarred: dto.isStarred,
    templateId: dto.templateId || undefined,
  };
}

export function teamFromDTO(dto: TeamDTO, boards: Board[] = []): Team {
  return {
    id: dto.id,
    name: dto.name,
    role: dto.role,
    boards,
    isStarred: dto.isStarred,
    boardCount: dto.boardCount,
    ageGroup: (dto.ageGroup || undefined) as AgeKey | undefined,
  };
}

/** Маппит список досок в модель фронта; цвет всегда выводится из id доски. */
export function mapBoards(dtos: BoardDTO[]): Board[] {
  return dtos.map((dto) => boardFromDTO(dto));
}

function pickInitialActiveTeamId(teams: Team[]): string | null {
  const withBoards = teams.find((t) => (t.boards || []).length > 0);
  return withBoards?.id ?? teams[0]?.id ?? null;
}

export function TeamsProvider({ children }: TeamsProviderProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const teamsRef = useRef<Team[]>([]);
  useEffect(() => { teamsRef.current = teams; }, [teams]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teamDTOs = await api.teams.list();
      const withBoards = await Promise.all(
        teamDTOs.map(async (t) => {
          try {
            const boards = await api.boards.listByTeam(t.id);
            return teamFromDTO(t, mapBoards(boards));
          } catch (e) {
            console.warn("failed to load boards for team", t.id, e);
            return teamFromDTO(t, []);
          }
        }),
      );
      setTeams(withBoards);

      setActiveTeamId((current) => {
        if (current && withBoards.some((t) => t.id === current)) return current;
        return pickInitialActiveTeamId(withBoards);
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      console.error("load teams failed:", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeTeam = useMemo(
    () => (activeTeamId ? teams.find((t) => t.id === activeTeamId) ?? null : null),
    [teams, activeTeamId],
  );
  const activeBoards = useMemo(() => activeTeam?.boards ?? [], [activeTeam]);

  const createTeam = useCallback(async ({ name, ageGroup }: { name: string; ageGroup?: AgeKey }) => {
    try {
      const created = await api.teams.create(name, ageGroup);
      const team = teamFromDTO(created, []);
      setTeams((prev) => [team, ...prev]);
      setActiveTeamId(team.id);
    } catch (e) {
      console.error("createTeam failed:", e);
      throw e;
    }
  }, []);

  const updateTeam = useCallback(
    async (teamId: string, patch: { name?: string; ageGroup?: AgeKey | "" }) => {
    try {
      const updated = await api.teams.update(teamId, patch);
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                name: updated.name,
                ageGroup: (updated.ageGroup || undefined) as AgeKey | undefined,
              }
            : t,
        ),
      );
    } catch (e) {
      console.error("updateTeam failed:", e);
      throw e;
    }
    },
    [],
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
      // optimistic
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, isStarred: nextStarred } : t)),
      );
      try {
        if (nextStarred) await api.teams.star(teamId);
        else await api.teams.unstar(teamId);
      } catch (e) {
        console.error("toggleStarTeam failed:", e);
        // revert
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
        setTeams((prev) =>
          prev.map((t) =>
            t.id === activeTeamId
              ? { ...t, boards: [board, ...(t.boards || [])] }
              : t,
          ),
        );
        return board;
      } catch (e) {
        console.error("createBoard failed:", e);
        return null;
      }
    },
    [activeTeamId],
  );

  const renameBoard = useCallback(
    async (boardId: string, newTitle: string) => {
      try {
        const updated = await api.boards.update(boardId, { name: newTitle });
        setTeams((prev) =>
          prev.map((team) => ({
            ...team,
            boards: (team.boards || []).map((b) =>
              b.id === boardId
                ? (() => {
                    const fresh = boardFromDTO(updated, b.colorKey);
                    return {
                      ...b,
                      title: fresh.title,
                      updated: fresh.updated,
                      updatedAt: fresh.updatedAt,
                      lastOpened: fresh.lastOpened,
                    };
                  })()
                : b,
            ),
          })),
        );
      } catch (e) {
        console.error("renameBoard failed:", e);
        throw e;
      }
    },
    [],
  );

  const deleteBoard = useCallback(async (boardId: string) => {
    try {
      await api.boards.delete(boardId);
      setTeams((prev) =>
        prev.map((team) => ({
          ...team,
          boards: (team.boards || []).filter((b) => b.id !== boardId),
        })),
      );
    } catch (e) {
      console.error("deleteBoard failed:", e);
      throw e;
    }
  }, []);

  const toggleStarBoard = useCallback(async (boardId: string) => {
    // Читаем актуальное состояние из ref, чтобы не полагаться на таймиг
    // выполнения updater-а в setState (он вызывается во время рендера, а не сразу).
    let currentStarred = false;
    for (const team of teamsRef.current) {
      const b = (team.boards || []).find((x) => x.id === boardId);
      if (b) { currentStarred = !!b.isStarred; break; }
    }
    const nextStarred = !currentStarred;

    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        boards: (team.boards || []).map((b) =>
          b.id === boardId ? { ...b, isStarred: nextStarred } : b,
        ),
      })),
    );
    try {
      if (nextStarred) await api.boards.star(boardId);
      else await api.boards.unstar(boardId);
    } catch (e) {
      console.error("toggleStarBoard failed:", e);
      // revert
      setTeams((prev) =>
        prev.map((team) => ({
          ...team,
          boards: (team.boards || []).map((b) =>
            b.id === boardId ? { ...b, isStarred: !nextStarred } : b,
          ),
        })),
      );
    }
  }, []);

  const value = useMemo<TeamsContextValue>(
    () => ({
      teams,
      activeTeamId,
      activeTeam,
      activeBoards,
      loading,
      error,
      setActiveTeamId,
      createTeam,
      updateTeam,
      deleteTeam,
      leaveTeam,
      toggleStarTeam,
      createBoard,
      renameBoard,
      deleteBoard,
      toggleStarBoard,
      refresh,
    }),
    [
      teams,
      activeTeamId,
      activeTeam,
      activeBoards,
      loading,
      error,
      createTeam,
      updateTeam,
      deleteTeam,
      leaveTeam,
      toggleStarTeam,
      createBoard,
      renameBoard,
      deleteBoard,
      toggleStarBoard,
      refresh,
    ],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams(): TeamsContextValue {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used within TeamsProvider");
  return ctx;
}
