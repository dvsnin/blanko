import { useMemo, useState } from "react";
import "./TeamsPanel.css";
import StarButton from "./StarButton";
import TeamSettingsModal from "./TeamSettingsModal";
import WorkspaceHeader from "./WorkspaceHeader";
import SettingsButton from "./SettingsButton";
import { useTeams } from "../contexts/TeamsContext";
import type { Team } from "../types";

/*
  TeamsPanel — renders the sidebar list of teams.
  All state comes from TeamsContext (single source of truth).
  No more duplicated teamsState, no more custom window events.
*/

export default function TeamsPanel() {
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    createTeam,
    renameTeam,
    deleteTeam,
    toggleStarTeam,
    leaveTeam,
    loading,
  } = useTeams();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "others">("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | (Partial<Team> & { create: boolean }) | null>(null);

  const visibleTeams = useMemo(() => {
    let list = teams.slice();
    if (filter === "mine") list = list.filter((t) => t.role === "owner");
    if (filter === "others") list = list.filter((t) => t.role !== "owner");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => String(t.name || "").toLowerCase().includes(q));
    }
    const starred = list.filter((t) => t.isStarred).sort((a, b) => a.name.localeCompare(b.name));
    const others = list.filter((t) => !t.isStarred).sort((a, b) => a.name.localeCompare(b.name));
    return [...starred, ...others];
  }, [teams, filter, query]);

  function openCreate() {
    setEditingTeam({ create: true, id: "", name: "Новая команда" } as Team & { create: boolean });
  }

  return (
    <>
      <aside className="teams-panel" aria-label="Команды">
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
                key={team.id}
                className={`team-item ${isActive ? "active" : ""}`}
                role="listitem"
                onMouseEnter={() => setHovered(team.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setActiveTeamId(team.id)}
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
                          toggleStarTeam(team.id);
                        }}
                        variant="list"
                        size={32}
                      />
                    </div>
                  </div>

                  <div className="team-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                    <SettingsButton
                      variant="list"
                      ariaLabel="Настройки команды"
                      size={32}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTeam(team);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {visibleTeams.length === 0 && !(loading && window.dashData?.hasTeams !== false) && (
            <div className="teams-empty muted">Команд не найдено - измените фильтр или создайте новую команду</div>
          )}
        </div>
      </aside>

      {editingTeam && (
        <TeamSettingsModal
          team={editingTeam as Team}
          onClose={() => setEditingTeam(null)}
          onSave={(teamId: string, newName: string) => {
            if ("create" in editingTeam && editingTeam.create) {
              createTeam({ name: newName });
            } else {
              renameTeam(teamId, newName);
            }
          }}
          onDelete={(teamId: string) => {
            deleteTeam(teamId);
          }}
          onLeave={(teamId: string) => {
            leaveTeam(teamId);
            setEditingTeam(null);
          }}
        />
      )}
    </>
  );
}
