import { useEffect, useMemo, useRef, useState } from "react";
import "./BoardCover.css";
import "./TeamSwitcher.css";
import StarButton from "./StarButton";
import TeamSettingsModal from "./TeamSettingsModal";
import { useTeams } from "../contexts/TeamsContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { colorForId, initialsOf } from "../utils/cover";
import { plural } from "../utils/plural";
import { ageLabel } from "../utils/templates";
import type { AgeKey } from "../constants/templates";
import type { Team } from "../types";

/*
  TeamSwitcher — кнопка текущей группы в топбаре и поповер со списком групп:
  поиск, клавиатура, переключение. Всё состояние — из TeamsContext.
*/

type Editing = Team | (Partial<Team> & { create: true });

export default function TeamSwitcher() {
  const {
    teams, activeTeamId, activeTeam, setActiveTeamId,
    createTeam, updateTeam, deleteTeam, leaveTeam, toggleStarTeam, loading,
  } = useTeams();
  const route = useHashRoute();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [wrapRef], []);

  const visibleTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? teams.filter((t) => (t.name || "").toLowerCase().includes(q)) : teams.slice();
    const byName = (a: Team, b: Team) => a.name.localeCompare(b.name, "ru");
    return [
      ...list.filter((t) => t.isStarred).sort(byName),
      ...list.filter((t) => !t.isStarred).sort(byName),
    ];
  }, [teams, query]);

  const close = useMemo(() => () => setOpen(false), []);
  useClickOutside(refs, close, open);
  useEscapeKey(close, open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open]);

  useEffect(() => { setHighlight(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest" });
  }, [highlight]);

  function selectTeam(id: string) {
    setActiveTeamId(id);
    setOpen(false);
    if (route.name !== "boards") navigate({ name: "boards" });
  }

  function openCreate() {
    setOpen(false);
    setEditing({ create: true, id: "", name: "" });
  }

  function boardCount(t: Team): number {
    return loading ? (t.boardCount ?? 0) : t.boards.length;
  }

  function subline(t: Team): string {
    const n = boardCount(t);
    const boards = plural(n, "доска", "доски", "досок");
    const age = ageLabel(t.ageGroup);
    return age ? `${age} · ${boards}` : boards;
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(visibleTeams.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = visibleTeams[highlight];
      if (t) selectTeam(t.id);
    }
  }

  // Пока идёт первый фетч, «Создать группу» не показываем, чтобы кнопка не мигала.
  const showCreateTrigger = !activeTeam && (!loading || window.dashData?.hasTeams === false);

  return (
    <>
      <div className="team-switcher" ref={wrapRef}>
        {activeTeam ? (
          <button
            type="button"
            className="btn btn--ghost team-switcher__trigger"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Текущая группа: ${activeTeam.name}. Открыть список групп`}
            title={activeTeam.name}
          >
            <span className={`team-switcher__mark cover--${colorForId(activeTeam.id)}`} aria-hidden>
              {initialsOf(activeTeam.name)}
            </span>
            <span className="team-switcher__name">{activeTeam.name}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : showCreateTrigger ? (
          <button type="button" className="btn btn--primary team-switcher__trigger" onClick={openCreate}>
            Создать группу
          </button>
        ) : null}

        {open && (
          <div className="team-switcher__pop" role="dialog" aria-label="Переключение группы">
            <div className="team-switcher__search">
              <input
                className="input"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Поиск группы..."
                aria-label="Поиск группы"
              />
            </div>

            <div className="team-switcher__list" role="listbox" aria-label="Группы" ref={listRef}>
              {visibleTeams.map((team, i) => {
                const isActive = team.id === activeTeamId;
                return (
                  <div
                    key={team.id}
                    role="option"
                    aria-selected={isActive}
                    className={`team-switcher__item${isActive ? " is-active" : ""}${i === highlight ? " is-hl" : ""}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => selectTeam(team.id)}
                  >
                    <span className={`team-switcher__mark team-switcher__mark--lg cover--${colorForId(team.id)}`} aria-hidden>
                      {initialsOf(team.name)}
                    </span>
                    <span className="team-switcher__main">
                      <span className="team-switcher__item-name" title={team.name}>{team.name}</span>
                      <span className="team-switcher__sub">{subline(team)}</span>
                    </span>
                    <span className="team-switcher__icons" onClick={(e) => e.stopPropagation()}>
                      <StarButton
                        isStarred={!!team.isStarred}
                        onToggle={() => toggleStarTeam(team.id)}
                        ariaLabel={team.isStarred ? "Убрать группу из избранного" : "Добавить группу в избранное"}
                        variant="list"
                        size={28}
                      />
                      {isActive && (
                        <svg className="team-switcher__check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  </div>
                );
              })}
              {visibleTeams.length === 0 && <div className="team-switcher__empty">Групп не найдено</div>}
            </div>

            <div className="team-switcher__footer">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setOpen(false); navigate({ name: "groups" }); }}
              >
                Все группы
              </button>
              <button type="button" className="btn btn--ghost" onClick={openCreate}>
                + Новая группа
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <TeamSettingsModal
          team={editing as Team}
          onClose={() => setEditing(null)}
          onSave={(teamId, { name, ageGroup }) => {
            if ("create" in editing && editing.create) {
              createTeam({ name, ageGroup: (ageGroup || undefined) as AgeKey | undefined });
            } else {
              updateTeam(teamId, { name, ageGroup });
            }
          }}
          onDelete={(teamId) => { deleteTeam(teamId); }}
          onLeave={(teamId) => { leaveTeam(teamId); setEditing(null); }}
        />
      )}
    </>
  );
}
