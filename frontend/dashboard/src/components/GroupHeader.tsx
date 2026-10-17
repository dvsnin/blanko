import "./BoardCover.css";
import "./GroupHeader.css";
import { colorForId, initialsOf } from "../utils/cover";
import { plural } from "../utils/plural";
import { ageLabel } from "../utils/templates";
import { teachersLabel } from "../utils/teachers";
import type { Team, TeamRole } from "../types";

const YOU_ROLE: Partial<Record<TeamRole, string>> = {
  admin: "вы администратор",
  member: "вы участник",
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
          {team.teachers ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>{teachersLabel(team.teachers)}: {team.teachers}</span>
            </>
          ) : canManage ? (
            <>
              <span aria-hidden="true"> · </span>
              <button type="button" className="link-btn" onClick={onSettings}>Указать воспитателя</button>
            </>
          ) : null}
          {YOU_ROLE[role] && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{YOU_ROLE[role]}</span>
            </>
          )}
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
        <button type="button" className="btn btn--soft" onClick={onCreateBoard}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Новая доска
        </button>
      </div>
    </section>
  );
}
