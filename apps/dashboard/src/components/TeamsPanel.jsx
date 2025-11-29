import React, { useMemo, useState } from "react";
import "./TeamsPanel.css";
import initialTeams from "./teamsData";
import StarButton from "./StarButton";
import TeamSettingsModal from "./TeamSettingsModal";
import WorkspaceHeader from "./WorkspaceHeader";

export default function TeamsPanel({
                                       teams: teamsProp,
                                       activeTeamId,
                                       setActiveTeamId,
                                       createTeam,
                                       renameTeam,
                                       deleteTeam,
                                       toggleStarTeam,
                                       leaveTeam,
                                   }) {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [hovered, setHovered] = useState(null);
    const [editingTeam, setEditingTeam] = useState(null);

    const teams = teamsProp || initialTeams.map((t) => ({ ...t, isStarred: !!t.isStarred, role: t.role || (t.isOwner ? "owner" : "member") }));

    const visibleTeams = useMemo(() => {
        let list = teams.slice();
        if (filter === "mine") list = list.filter((t) => t.role === "owner");
        if (filter === "others") list = list.filter((t) => t.role !== "owner");
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            list = list.filter((t) => t.name.toLowerCase().includes(q));
        }
        const starred = list.filter((t) => t.isStarred).sort((a, b) => a.name.localeCompare(b.name));
        const others = list.filter((t) => !t.isStarred).sort((a, b) => a.name.localeCompare(b.name));
        return [...starred, ...others];
    }, [teams, filter, query]);

    function openCreate() {
        setEditingTeam({ create: true, id: null, name: "" });
    }

    function openSettingsForActive() {
        if (!activeTeamId) return;
        const team = teams.find((t) => t.id === activeTeamId);
        if (team) setEditingTeam(team);
    }

    function handleToggleStar(teamId) {
        if (toggleStarTeam) toggleStarTeam(teamId);
    }

    return (
        <>
            <aside className="teams-panel" aria-label="Teams">
                <WorkspaceHeader />

                <div className="teams-panel-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="teams-title">Команды</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                            type="button"
                            className="teams-plus-btn"
                            onClick={openCreate}
                            aria-label="Создать команду"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            <span className="sr-only">Создать команду</span>
                        </button>

                        <button
                            type="button"
                            className={`teams-header-settings ${!activeTeamId ? "disabled" : ""}`}
                            onClick={() => {
                                if (!activeTeamId) return;
                                openSettingsForActive();
                            }}
                            aria-label="Настройки выбранной команды"
                            disabled={!activeTeamId}
                        >
                            <svg className="teams-header-gear" width="20" height="20" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path fillRule="evenodd" clipRule="evenodd" d="M.969 12.016v2H3.03v1h3v-1h8.938v-2H6.03v-1h-3v1H.97zm0-3v-2h9.062v-1h3v1h1.938v2H13.03v1h-3v-1H.97zm0-5v-2H5.03v-1h3v1h6.938v2H8.03v1h-3v-1H.97z" fill="currentColor"></path>
                            </svg>
                            <span className="sr-only">Настройки выбранной команды</span>
                        </button>
                    </div>
                </div>

                <div className="teams-search-row">
                    <input
                        aria-label="Поиск команды"
                        placeholder="Поиск команды..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="teams-filters" role="tablist" aria-label="Фильтры команд">
                    <button className={`teams-filter ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Все</button>
                    <button className={`teams-filter ${filter === "mine" ? "active" : ""}`} onClick={() => setFilter("mine")}>Мои</button>
                    <button className={`teams-filter ${filter === "others" ? "active" : ""}`} onClick={() => setFilter("others")}>Другие</button>
                </div>

                <div className="teams-list" role="list">
                    {visibleTeams.map((team) => {
                        const isActive = team.id === activeTeamId;
                        const showStar = !!team.isStarred || hovered === team.id;

                        return (
                            <div
                                key={team.id || Math.random()}
                                className={`team-item ${isActive ? "active" : ""}`}
                                role="listitem"
                                onMouseEnter={() => setHovered(team.id)}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => setActiveTeamId && setActiveTeamId(team.id)}
                            >
                                <div className="team-main">
                                    <div className="team-name" title={team.name}>{team.name}</div>
                                    <div className="team-meta">{(team.boards || []).length} досок · {team.role}</div>
                                </div>

                                <div className="team-item-icons" onClick={(e) => e.stopPropagation()}>
                                    <div className="team-icon-slot">
                                        <div style={{ display: showStar ? "inline-flex" : "none" }}>
                                            <StarButton
                                                isStarred={!!team.isStarred}
                                                onToggle={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleStar(team.id);
                                                }}
                                                variant="list"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {visibleTeams.length === 0 && <div className="teams-empty muted">Команд не найдено - измените фильтр или создайте новую команду</div>}
                </div>
            </aside>

            {editingTeam && (
                <TeamSettingsModal
                    team={editingTeam.create ? { id: null, name: "" } : editingTeam}
                    onClose={() => setEditingTeam(null)}
                    onSave={(teamId, newName) => {
                        if (editingTeam.create) {
                            createTeam && createTeam({ name: newName, isOwner: true });
                        } else {
                            renameTeam && renameTeam(teamId, newName);
                        }
                    }}
                    onDelete={(teamId) => {
                        deleteTeam && deleteTeam(teamId);
                    }}
                    onLeave={(teamId) => {
                        if (typeof leaveTeam === "function") leaveTeam(teamId);
                        setEditingTeam(null);
                    }}
                />
            )}
        </>
    );
}