import { useState, useMemo } from "react";
import "./app.css";

import Boards from "./components/Boards";
import TeamsPanel from "./components/TeamsPanel";
import initialTeams from "./components/teamsData";

/*
  App.jsx — roles-only logic.
  - Teams must have role: "owner" | "admin" | "member".
  - leaveTeam: remove team for non-owners (admin/member). Owner cannot leave.
  - deleteTeam: owner-only action (UI ensures that), removes team.
*/

const VALID_ROLES = new Set(["owner", "admin", "member"]);

export default function App() {
    const currentUser =
        (typeof window !== "undefined" && window.dashData && window.dashData.login) || "dvsnin";

    // Initialize teams: keep only teams with valid role
    const [teams, setTeams] = useState(() => {
        return (initialTeams || [])
            .filter((t) => VALID_ROLES.has(t.role))
            .map((t) => ({
                ...t,
                isStarred: !!t.isStarred,
                role: t.role,
                ownerId: t.ownerId || undefined,
            }));
    });

    // Pick default active team (first with boards or first in list)
    const defaultTeamId = useMemo(() => {
        if (!teams || teams.length === 0) return null;
        const withBoards = teams.find((t) => t.boards && t.boards.length > 0);
        return withBoards ? withBoards.id : teams[0].id;
    }, [teams]);

    const [activeTeamId, setActiveTeamId] = useState(defaultTeamId);

    function createTeam({ name }) {
        const id = `team-${Date.now().toString(36).slice(-6)}`;
        const newTeam = {
            id,
            name,
            role: "owner",
            ownerId: currentUser,
            boards: [],
            isStarred: false,
        };
        setTeams((prev) => [newTeam, ...prev]);
        setActiveTeamId(id);
    }

    function createBoard(title = "Новая доска") {
        if (!activeTeamId) return alert("Выберите команду слева, чтобы создать доску.");
        setTeams((prev) =>
            prev.map((t) =>
                t.id === activeTeamId
                    ? {
                        ...t,
                        boards: [
                            {
                                id: Date.now(),
                                title,
                                owner: "You",
                                lastOpened: "только что",
                                colorKey: undefined,
                            },
                            ...(t.boards || []),
                        ],
                    }
                    : t
            )
        );
    }

    function renameTeam(teamId, newName) {
        setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: newName } : t)));
    }

    // deleteTeam — owner/instrumented by UI; just remove the team
    function deleteTeam(teamId) {
        setTeams((prev) => {
            const remaining = prev.filter((t) => t.id !== teamId);
            if (activeTeamId === teamId) {
                const next = remaining.length ? remaining[0].id : null;
                setActiveTeamId(next);
            }
            return remaining;
        });
    }

    function toggleStarTeam(teamId) {
        setTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, isStarred: !t.isStarred } : t))
        );
    }

    function renameBoard(boardId, newTitle) {
        setTeams((prev) =>
            prev.map((team) => ({
                ...team,
                boards: (team.boards || []).map((b) => (b.id === boardId ? { ...b, title: newTitle } : b)),
            }))
        );
    }

    function deleteBoard(boardId) {
        setTeams((prev) =>
            prev.map((team) => ({ ...team, boards: (team.boards || []).filter((b) => b.id !== boardId) }))
        );
    }

    // LEAVE TEAM
    // - If team.role === "owner" => do NOT allow leave on client side
    // - Otherwise remove the team from the user's teams list (admin/member leave => team disappears)
    function leaveTeam(teamId) {
        setTeams((prev) => {
            const team = prev.find((t) => t.id === teamId);
            if (!team) return prev;

            if (team.role === "owner") {
                // safeguard: do not allow owner to leave via this flow
                return prev;
            }

            // remove team for this user
            const remaining = prev.filter((t) => t.id !== teamId);

            // if active team was removed, pick fallback
            if (activeTeamId === teamId) {
                const next = remaining.length ? remaining[0].id : null;
                setActiveTeamId(next);
            }

            return remaining;
        });
    }

    return (
        <div className="app-layout">
            <TeamsPanel
                teams={teams}
                activeTeamId={activeTeamId}
                setActiveTeamId={setActiveTeamId}
                createTeam={createTeam}
                renameTeam={renameTeam}
                deleteTeam={deleteTeam}
                toggleStarTeam={toggleStarTeam}
                leaveTeam={leaveTeam}
            />

            <div className="content">
                <Boards
                    teams={teams}
                    activeTeamId={activeTeamId}
                    setActiveTeamId={setActiveTeamId}
                    createBoard={createBoard}
                    renameBoard={renameBoard}
                    deleteBoard={deleteBoard}
                />
            </div>
        </div>
    );
}