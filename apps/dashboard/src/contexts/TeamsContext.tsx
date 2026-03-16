import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { Team, Board, TeamRole } from "../types";
import { VALID_ROLES } from "../constants/roles";
import { pickAvailableColor } from "../utils/colors";
import initialTeams from "../components/teamsData";

/* ------------------------------------------------------------------ */
/*  Context value shape                                                */
/* ------------------------------------------------------------------ */

interface TeamsContextValue {
  /** All teams (filtered to valid roles). */
  teams: Team[];
  /** Currently selected team id (or null). */
  activeTeamId: string | null;
  /** The currently selected team object (convenience). */
  activeTeam: Team | null;
  /** Boards belonging to the active team. */
  activeBoards: Board[];

  /* ---- Mutations ---- */
  setActiveTeamId: (id: string | null) => void;
  createTeam: (opts: { name: string }) => void;
  renameTeam: (teamId: string, newName: string) => void;
  deleteTeam: (teamId: string) => void;
  leaveTeam: (teamId: string) => void;
  toggleStarTeam: (teamId: string) => void;
  createBoard: (title?: string) => Board | null;
  renameBoard: (boardId: number, newTitle: string) => void;
  deleteBoard: (boardId: number) => void;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

interface TeamsProviderProps {
  children: ReactNode;
  /** Current user login – used as ownerId when creating teams. */
  currentUser?: string;
}

export function TeamsProvider({ children, currentUser = "dvsnin" }: TeamsProviderProps) {
  const [teams, setTeams] = useState<Team[]>(() =>
    (initialTeams || [])
      .filter((t) => VALID_ROLES.has(t.role))
      .map((t) => ({
        ...t,
        isStarred: !!t.isStarred,
        ownerId: t.ownerId || undefined,
      })),
  );

  /* Pick a sensible default active team (first with boards, or just the first). */
  const defaultTeamId = useMemo(() => {
    if (!teams.length) return null;
    const withBoards = teams.find((t) => t.boards?.length > 0);
    return withBoards ? withBoards.id : teams[0].id;
  }, []); // intentionally runs only once on mount

  const [activeTeamId, setActiveTeamId] = useState<string | null>(defaultTeamId);

  /* ---- Derived values ---- */

  const activeTeam = useMemo(
    () => (activeTeamId ? teams.find((t) => t.id === activeTeamId) ?? null : null),
    [teams, activeTeamId],
  );

  const activeBoards = useMemo(() => activeTeam?.boards ?? [], [activeTeam]);

  /* ---- Team mutations ---- */

  const createTeam = useCallback(
    ({ name }: { name: string }) => {
      const id = `team-${Date.now().toString(36).slice(-6)}`;
      const newTeam: Team = {
        id,
        name,
        role: "owner",
        ownerId: currentUser,
        boards: [],
        isStarred: false,
      };
      setTeams((prev) => [newTeam, ...prev]);
      setActiveTeamId(id);
    },
    [currentUser],
  );

  const renameTeam = useCallback((teamId: string, newName: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, name: newName } : t)),
    );
  }, []);

  const deleteTeam = useCallback(
    (teamId: string) => {
      setTeams((prev) => {
        const remaining = prev.filter((t) => t.id !== teamId);
        if (activeTeamId === teamId) {
          setActiveTeamId(remaining.length ? remaining[0].id : null);
        }
        return remaining;
      });
    },
    [activeTeamId],
  );

  const leaveTeam = useCallback(
    (teamId: string) => {
      setTeams((prev) => {
        const team = prev.find((t) => t.id === teamId);
        if (!team || team.role === "owner") return prev; // owners cannot leave

        const remaining = prev.filter((t) => t.id !== teamId);
        if (activeTeamId === teamId) {
          setActiveTeamId(remaining.length ? remaining[0].id : null);
        }
        return remaining;
      });
    },
    [activeTeamId],
  );

  const toggleStarTeam = useCallback((teamId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, isStarred: !t.isStarred } : t)),
    );
  }, []);

  /* ---- Board mutations ---- */

  const createBoard = useCallback(
    (title = "Новая доска"): Board | null => {
      if (!activeTeamId) return null;

      const newBoard: Board = {
        id: Date.now(),
        title,
        owner: "You",
        lastOpened: "только что",
        colorKey: undefined,
      };

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== activeTeamId) return t;
          const color = pickAvailableColor(t.boards || []);
          return {
            ...t,
            boards: [{ ...newBoard, colorKey: color }, ...(t.boards || [])],
          };
        }),
      );

      return newBoard;
    },
    [activeTeamId],
  );

  const renameBoard = useCallback((boardId: number, newTitle: string) => {
    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        boards: (team.boards || []).map((b) =>
          b.id === boardId ? { ...b, title: newTitle } : b,
        ),
      })),
    );
  }, []);

  const deleteBoard = useCallback((boardId: number) => {
    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        boards: (team.boards || []).filter((b) => b.id !== boardId),
      })),
    );
  }, []);

  /* ---- Context value (stable reference via useMemo) ---- */

  const value = useMemo<TeamsContextValue>(
    () => ({
      teams,
      activeTeamId,
      activeTeam,
      activeBoards,
      setActiveTeamId,
      createTeam,
      renameTeam,
      deleteTeam,
      leaveTeam,
      toggleStarTeam,
      createBoard,
      renameBoard,
      deleteBoard,
    }),
    [
      teams,
      activeTeamId,
      activeTeam,
      activeBoards,
      createTeam,
      renameTeam,
      deleteTeam,
      leaveTeam,
      toggleStarTeam,
      createBoard,
      renameBoard,
      deleteBoard,
    ],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useTeams(): TeamsContextValue {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used within TeamsProvider");
  return ctx;
}
