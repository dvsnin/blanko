import { useMemo, useRef, useState } from "react";
import "../components/BoardCover.css";
import "./GroupsPage.css";
import ConfirmModal from "../components/ConfirmModal";
import MenuButton from "../components/MenuButton";
import StarToggle, { starMessage, STAR_LABEL } from "../components/StarToggle";
import TeamSettingsModal, { NEW_TEAM } from "../components/TeamSettingsModal";
import { VALID_ROLES } from "../constants/roles";
import { useTeams } from "../contexts/TeamsContext";
import { useTemplates } from "../contexts/TemplatesContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useToast } from "../hooks/useToast";
import { navigate } from "../hooks/useHashRoute";
import { initialsOf } from "../utils/cover";
import { colorOf } from "../utils/colors";
import { plural } from "../utils/plural";
import { formatRelative } from "../utils/relativeTime";
import { ageLabel, coverForBoard } from "../utils/templates";
import { teachersLabel } from "../utils/teachers";
import type { AgeKey } from "../constants/templates";
import type { Board, Team, TeamRole } from "../types";

/* GroupsPage - экран «Группы»: сетка кликабельных карточек (вариант Б). */

type Editing = Team | typeof NEW_TEAM;

const ROLE_TEXT: Record<TeamRole, string> = {
  owner: "вы владелец",
  admin: "вы администратор",
  member: "вы участник",
};

const RECENT = 3;

function recentBoards(boards: Board[]): Board[] {
  const t = (b: Board) => {
    const v = Date.parse(b.lastOpenedAt ?? b.updatedAt ?? "");
    return Number.isNaN(v) ? 0 : v;
  };
  return [...boards].sort((a, b) => t(b) - t(a)).slice(0, RECENT);
}

interface GroupMenuProps {
  team: Team;
  /** Состояние держит карточка: закрывает меню при уходе курсора. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettings: () => void;
  onToggleStar: () => void;
  onLeave: () => void;
}

function GroupMenu({ team, open, onOpenChange, onSettings, onToggleStar, onLeave }: GroupMenuProps) {
  const setOpen = onOpenChange;
  const wrapRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [wrapRef], []);
  const close = () => setOpen(false);
  useClickOutside(refs, close, open);
  useEscapeKey(close, open);

  const validRole = VALID_ROLES.has(team.role);
  const canEdit = validRole && (team.role === "owner" || team.role === "admin");
  const canLeave = validRole && team.role !== "owner";

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="group-card__menu" ref={wrapRef}>
      <MenuButton
        ariaLabel="Действия с группой"
        ariaHasPopup="menu"
        ariaExpanded={open}
        variant="list"
        size={36}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="group-card__popover" role="menu">
          {canEdit && (
            <button type="button" role="menuitem" className="group-card__menu-item" onClick={() => run(onSettings)}>
              Настройки группы
            </button>
          )}
          <button type="button" role="menuitem" className="group-card__menu-item" onClick={() => run(onToggleStar)}>
            {team.isStarred ? STAR_LABEL.remove : STAR_LABEL.add}
          </button>
          {canLeave && (
            <button
              type="button"
              role="menuitem"
              className="group-card__menu-item group-card__menu-item--danger"
              onClick={() => run(onLeave)}
            >
              Покинуть группу
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupsPage() {
  const {
    teams, activeTeamId, setActiveTeamId, createTeam, updateTeam, deleteTeam, leaveTeam, toggleStarTeam, loading,
  } = useTeams();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [leaving, setLeaving] = useState<Team | null>(null);
  const [menuTeamId, setMenuTeamId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [now] = useState(() => new Date());
  const { toastMessage, toastVisible, showToast } = useToast();
  const { byId: byTemplateId } = useTemplates();

  // Пункт меню «В избранное»: тот же тост, что у звезды (StarToggle)
  const starTeam = (team: Team) => {
    const willStar = !team.isStarred;
    void toggleStarTeam(team.id);
    showToast(starMessage(willStar));
  };

  const sorted = useMemo(() => {
    const byName = (a: Team, b: Team) => a.name.localeCompare(b.name, "ru");
    const rank = (t: Team) => (t.id === activeTeamId ? 0 : t.isStarred ? 1 : 2);
    return [...teams].sort((a, b) => rank(a) - rank(b) || byName(a, b));
  }, [teams, activeTeamId]);

  const needle = q.trim().toLowerCase();
  const visible = needle ? sorted.filter((t) => t.name.toLowerCase().includes(needle)) : sorted;

  const countOf = (t: Team) => (loading ? t.boardCount ?? 0 : t.boards.length);
  const totalBoards = teams.reduce((s, t) => s + countOf(t), 0);

  function openBoards(id: string) {
    setActiveTeamId(id);
    navigate({ name: "boards" });
  }

  async function confirmLeave() {
    const team = leaving;
    setLeaving(null);
    if (!team) return;
    try { await leaveTeam(team.id); } catch { showToast("Не удалось выйти из группы"); }
  }

  const showBody = !(loading && teams.length === 0);

  return (
    <main className="page groups">
      <div className="groups__head">
        <div className="groups__heading">
          <h1 className="groups__title">Группы</h1>
          {showBody && (
            <p className="groups__sub">
              {plural(teams.length, "группа", "группы", "групп")} · {plural(totalBoards, "доска", "доски", "досок")}
            </p>
          )}
        </div>
        {showBody && (
          <>
            <label className="input input--search groups__search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="visually-hidden">Поиск групп</span>
              <input
                type="text"
                value={q}
                placeholder="Найти группу…"
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button type="button" className="groups__clear" aria-label="Очистить поиск" onClick={() => setQ("")}>×</button>
              )}
            </label>
            <button type="button" className="btn btn--soft" onClick={() => setEditing(NEW_TEAM)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Создать группу
            </button>
          </>
        )}
      </div>

      {showBody && (
        <div className="groups__grid">
          {visible.map((team) => {
            const count = countOf(team);
            const recent = recentBoards(team.boards);
            const isActive = team.id === activeTeamId;
            const age = ageLabel(team.ageGroup) ?? "Возраст не указан";
            const teachers = team.teachers
              ? `${teachersLabel(team.teachers)}: ${team.teachers}`
              : "Воспитатель не указан";
            const countWord = plural(count, "доска", "доски", "досок").split(" ")[1];
            return (
              <div
                key={team.id}
                className={`group-card${isActive ? " group-card--active" : ""}${team.isStarred ? " group-card--starred" : ""}${menuTeamId === team.id ? " group-card--menu-open" : ""}`}
                onMouseLeave={() => { if (menuTeamId === team.id) setMenuTeamId(null); }}
              >
                {team.isStarred && <span className="card-star-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z" /></svg></span>}
                <button type="button" className="group-card__main" onClick={() => openBoards(team.id)}>
                  <span className="group-card__top">
                    <span className={`group-card__mark cover--${colorOf(team)}`} aria-hidden>
                      {initialsOf(team.name)}
                    </span>
                    <span className="group-card__who">
                      <span className="group-card__name">
                        <span className="group-card__name-text" title={team.name}>{team.name}</span>
                        {isActive && <span className="visually-hidden">текущая группа</span>}
                      </span>
                      <span className="group-card__sub">{age} · {teachers}</span>
                    </span>
                  </span>
                  <span className="group-card__bottom">
                    <span className={`group-card__count${count === 0 ? " group-card__count--empty" : ""}`}>
                      <span className="group-card__num">{count}</span>
                      <span className="group-card__unit">{countWord}</span>
                    </span>
                    {count === 0 ? (
                      <span className="group-card__empty">
                        <span className="group-card__empty-title">Досок пока нет</span>
                        <span className="group-card__sub">откройте группу и создайте первую или возьмите шаблон</span>
                      </span>
                    ) : (
                      <span className="group-card__boards">
                        {recent.map((b) => {
                          const c = coverForBoard(b, byTemplateId(b.templateId));
                          return (
                            <span key={b.id} className="group-card__row">
                              <span className={`group-card__mini cover--${c.colorKey}`} aria-hidden>{c.glyph}</span>
                              <span className="group-card__row-title">{b.title}</span>
                              <span className="group-card__when">{formatRelative(b.lastOpenedAt ?? b.updatedAt, now)}</span>
                            </span>
                          );
                        })}
                        {count > RECENT && (
                          <span className="group-card__sub">
                            и ещё {plural(count - RECENT, "доска", "доски", "досок")}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="group-card__role">{ROLE_TEXT[team.role] ?? ""}</span>
                </button>
                <div className="group-card__actions">
                  <StarToggle
                    isStarred={!!team.isStarred}
                    onToggle={() => toggleStarTeam(team.id)}
                    notify={showToast}
                    variant="list"
                    size={36}
                  />
                  <GroupMenu
                    team={team}
                    open={menuTeamId === team.id}
                    onOpenChange={(open) => setMenuTeamId(open ? team.id : null)}
                    onSettings={() => setEditing(team)}
                    onToggleStar={() => starTeam(team)}
                    onLeave={() => setLeaving(team)}
                  />
                </div>
              </div>
            );
          })}

          {needle && visible.length === 0 && (
            <p className="groups__none">Групп с таким названием нет</p>
          )}

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
          onSave={async (teamId, { name, ageGroup, teachers }) => {
            try {
              if ("create" in editing) {
                await createTeam({ name, ageGroup: (ageGroup || undefined) as AgeKey | undefined, teachers: teachers || undefined });
              } else {
                await updateTeam(teamId, { name, ageGroup, teachers });
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
      <ConfirmModal
        isOpen={!!leaving}
        compact
        title="Покинуть группу?"
        message={<p style={{ margin: 0 }}>Вы потеряете доступ ко всем доскам группы <strong>{leaving?.name}</strong>. Администратор сможет пригласить вас снова при необходимости.</p>}
        confirmLabel="Покинуть"
        cancelLabel="Отмена"
        danger
        onConfirm={confirmLeave}
        onCancel={() => setLeaving(null)}
      />
      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </main>
  );
}
