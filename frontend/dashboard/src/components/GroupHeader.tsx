import "./BoardCover.css";
import "./GroupHeader.css";
import { colorForId, initialsOf } from "../utils/cover";
import { plural } from "../utils/plural";
import { ageLabel } from "../utils/templates";
import type { Team, TeamRole } from "../types";

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
};

export interface GroupHeaderProps {
  team: Team | null;
  boardsCount: number;
  role: TeamRole;
  onSettings(): void;
  onFromTemplate(): void;
  onCreateBoard(): void;
  onCreateTeam(): void;
}

export default function GroupHeader({
  team, boardsCount, role, onSettings, onFromTemplate, onCreateBoard, onCreateTeam,
}: GroupHeaderProps) {
  if (!team) {
    return (
      <section className="group-header group-header--empty card" role="status">
        <p className="group-header__empty-text">Чтобы создавать доски, создайте группу</p>
        <button type="button" className="btn btn--primary" onClick={onCreateTeam}>
          Создать группу
        </button>
      </section>
    );
  }

  const canManage = role === "owner" || role === "admin";
  const age = ageLabel(team.ageGroup);

  return (
    <section className="group-header card" aria-label="Группа">
      <div className={`group-header__badge cover--${colorForId(team.id)}`} aria-hidden="true">
        {initialsOf(team.name)}
      </div>
      <div className="group-header__text">
        <h1 className="group-header__title">{team.name}</h1>
        <p className="group-header__meta">
          {age ? (
            <span>{age}</span>
          ) : canManage ? (
            <button type="button" className="link-btn" onClick={onSettings}>Указать возраст</button>
          ) : (
            <span>Возраст не указан</span>
          )}
          <span aria-hidden="true"> · </span>
          <span>{plural(boardsCount, "доска", "доски", "досок")}</span>
          <span aria-hidden="true"> · </span>
          <span>{ROLE_LABEL[role]}</span>
        </p>
      </div>
      <div className="group-header__actions">
        {canManage && (
          <button type="button" className="btn btn--ghost" onClick={onSettings}>
            Настройки группы
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onFromTemplate}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
          Из шаблона
        </button>
        <button type="button" className="btn btn--primary" onClick={onCreateBoard}>
          Новая доска
        </button>
      </div>
    </section>
  );
}
