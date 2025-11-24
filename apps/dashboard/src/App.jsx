import { useState, useMemo } from "react";
import "./app.css";

import Boards from "./components/Boards";
import TeamsPanel from "./components/TeamsPanel";
import initialTeams from "./components/teamsData";

/*
  App.jsx — updated:
  - Ensure at least one team has role 'owner' on init and after deletions.
  - createTeam sets role: 'owner' and isOwner: true; ownerId set from window.dashData.login || 'dvsnin'.
  - Removed moveBoard prop (UI for moving boards was removed).
  - Passes setActiveTeamId down to Boards so ProfileModal can change active team.
*/

export default function App() {
    // derive current user id from page data if available
    const currentUser =
        (typeof window !== "undefined" && window.dashData && window.dashData.login) || "dvsnin";

    // teams state — ensure at least one owner exists
    const [teams, setTeams] = useState(() => {
        const mapped = initialTeams.map((t) => ({
            ...t,
            isStarred: !!t.isStarred,
            role: t.role || (t.isOwner ? "owner" : t.role || "member"),
            isOwner: !!t.isOwner || t.role === "owner",
            ownerId: t.ownerId || undefined,
        }));
        const hasOwner = mapped.some((t) => t.role === "owner");
        if (!hasOwner && mapped.length) {
            mapped[0].role = "owner";
            mapped[0].isOwner = true;
            mapped[0].ownerId = currentUser;
        }
        return mapped;
    });

    // activeTeam default: pick first team with boards or first team
    const defaultTeamId = useMemo(() => {
        if (!teams || teams.length === 0) return null;
        const withBoards = teams.find((t) => t.boards && t.boards.length > 0);
        return withBoards ? withBoards.id : teams[0].id;
    }, [teams]);

    const [activeTeamId, setActiveTeamId] = useState(defaultTeamId);

    // create team — now sets role 'owner' and records ownerId
    function createTeam({ name }) {
        const id = `team-${Date.now().toString(36).slice(-6)}`;
        const newTeam = {
            id,
            name,
            isOwner: true,
            role: "owner",
            ownerId: currentUser,
            boards: [],
            isStarred: false,
        };
        setTeams((prev) => [newTeam, ...prev]);
        setActiveTeamId(id);
    }

    // create board under active team
    function createBoard(title = "Untitled") {
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

    // rename team
    function renameTeam(teamId, newName) {
        setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: newName } : t)));
    }

    // delete team (also removes all boards belonging to the team)
    function deleteTeam(teamId) {
        setTeams((prev) => {
            const remaining = prev.filter((t) => t.id !== teamId);
            // ensure at least one owner exists
            const hasOwner = remaining.some((t) => t.role === "owner");
            if (!hasOwner && remaining.length) {
                remaining[0] = { ...remaining[0], role: "owner", isOwner: true, ownerId: currentUser };
            }
            return remaining;
        });

        if (activeTeamId === teamId) {
            const remaining = teams.filter((t) => t.id !== teamId);
            setActiveTeamId(remaining.length ? remaining[0].id : null);
        }
    }

    // toggle star on a team
    function toggleStarTeam(teamId) {
        setTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, isStarred: !t.isStarred } : t))
        );
    }

    // rename board, deleteBoard remain as before (if forwarded from Boards)
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

    // leaveTeam: only allowed for non-owner roles (admin/member).
    function leaveTeam(teamId) {
        setTeams((prev) =>
            prev.map((t) => {
                if (t.id !== teamId) return t;
                // if owner — do not allow leaving here (UI prevents it). But as a safeguard, if owner tries
                // to leave we will not change role; otherwise set role to 'member' and isOwner false.
                if (t.role === "owner") return t;
                return { ...t, isOwner: false, role: "member", ownerId: undefined };
            })
        );
    }

    return (
        <div className="app-layout">
            {/* Left: Teams panel */}
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

            {/* Main content */}
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