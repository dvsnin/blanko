import { useMemo, useState } from "react";
import "../components/BoardCover.css";
import "./GroupsPage.css";
import StarButton from "../components/StarButton";
import TeamSettingsModal, { NEW_TEAM } from "../components/TeamSettingsModal";
import { useTeams } from "../contexts/TeamsContext";
import { useToast } from "../hooks/useToast";
import { navigate } from "../hooks/useHashRoute";
import { colorForId, initialsOf } from "../utils/cover";
import { plural } from "../utils/plural";
import { ageLabel } from "../utils/templates";
import type { AgeKey } from "../constants/templates";
import type { Team, TeamRole } from "../types";

/* GroupsPage — экран «Группы»: сетка карточек групп пользователя. */

type Editing = Team | typeof NEW_TEAM;

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
};

export default function GroupsPage() {
  const {
    teams, setActiveTeamId, createTeam, updateTeam, deleteTeam, leaveTeam, toggleStarTeam, loading,
  } = useTeams();
  const [editing, setEditing] = useState<Editing | null>(null);
  const { toastMessage, toastVisible, showToast } = useToast();

  const sorted = useMemo(() => {
    const byName = (a: Team, b: Team) => a.name.localeCompare(b.name, "ru");
    return [
      ...teams.filter((t) => t.isStarred).sort(byName),
      ...teams.filter((t) => !t.isStarred).sort(byName),
    ];
  }, [teams]);

  function openBoards(id: string) {
    setActiveTeamId(id);
    navigate({ name: "boards" });
  }

  const showBody = !(loading && teams.length === 0);

  return (
    <main className="page groups">
      <div className="groups__head">
        <div>
          <h1 className="groups__title">Группы</h1>
          {showBody && (
            <p className="groups__sub">{plural(teams.length, "группа", "группы", "групп")}</p>
          )}
        </div>
        {showBody && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing(NEW_TEAM)}>
            Создать группу
          </button>
        )}
      </div>

      {showBody && (
        <div className="groups__grid">
          {sorted.map((team) => {
            const count = loading ? team.boardCount ?? 0 : team.boards.length;
            const canEdit = team.role === "owner" || team.role === "admin";
            return (
              <article key={team.id} className={`card groups-card cover--${colorForId(team.id)}`}>
                <div className="groups-card__band">
                  <span className="groups-card__mark" aria-hidden>{initialsOf(team.name)}</span>
                </div>
                <div className="groups-card__body">
                  <div className="groups-card__titlerow">
                    <h2 className="groups-card__name" title={team.name}>{team.name}</h2>
                    <StarButton
                      isStarred={!!team.isStarred}
                      onToggle={() => toggleStarTeam(team.id)}
                      ariaLabel={team.isStarred ? "Убрать группу из избранного" : "Добавить группу в избранное"}
                      variant="list"
                      size={28}
                    />
                  </div>
                  <p className="groups-card__sub">
                    {ageLabel(team.ageGroup) ?? "Возраст не указан"} · {ROLE_LABEL[team.role]}
                  </p>
                  <div className="groups-card__chips">
                    <span className="chip chip--muted">{plural(count, "доска", "доски", "досок")}</span>
                  </div>
                  <div className="groups-card__actions">
                    <button type="button" className="btn groups-card__open" onClick={() => openBoards(team.id)}>
                      Открыть доски
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn--icon"
                        aria-label="Настройки группы"
                        title="Настройки группы"
                        onClick={() => setEditing(team)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          <button type="button" className="groups-new" onClick={() => setEditing(NEW_TEAM)}>
            <span className="groups-new__plus" aria-hidden>+</span>
            <span className="groups-new__label">Новая группа</span>
          </button>
        </div>
      )}

      {editing && (
        <TeamSettingsModal
          team={editing}
          onClose={() => setEditing(null)}
          onSave={async (teamId, { name, ageGroup }) => {
            try {
              if ("create" in editing) {
                await createTeam({ name, ageGroup: (ageGroup || undefined) as AgeKey | undefined });
              } else {
                await updateTeam(teamId, { name, ageGroup });
              }
            } catch (e) {
              showToast("Не удалось сохранить группу");
              throw e;
            }
          }}
          onDelete={async (teamId) => {
            try { await deleteTeam(teamId); } catch (e) { showToast("Не удалось удалить группу"); throw e; }
          }}
          onLeave={async (teamId) => {
            try { await leaveTeam(teamId); } catch (e) { showToast("Не удалось выйти из группы"); throw e; }
          }}
        />
      )}
      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </main>
  );
}
