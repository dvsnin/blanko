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
  onCreateBoard(): void;
  onCreateTeam(): void;
}

export default function GroupHeader({
  team, boardsCount, role, onSettings, onCreateBoard, onCreateTeam,
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
        <button type="button" className="btn btn--primary" onClick={onCreateBoard}>
          Новая доска
        </button>
      </div>
    </section>
  );
}
