import { useEffect, useMemo, useRef, useState } from "react";
import "./BoardCover.css";
import "./TeamSwitcher.css";
import StarToggle from "./StarToggle";
import TeamSettingsModal, { NEW_TEAM } from "./TeamSettingsModal";
import { useTeams } from "../contexts/TeamsContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { useToast } from "../hooks/useToast";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { initialsOf } from "../utils/cover";
import { colorOf } from "../utils/colors";
import { plural } from "../utils/plural";
import { ageLabel } from "../utils/templates";
import type { AgeKey } from "../constants/templates";
import type { Team } from "../types";

/*
  TeamSwitcher - кнопка текущей группы в топбаре и поповер со списком групп:
  поиск, клавиатура, переключение. Всё состояние - из TeamsContext.
*/

type Editing = Team | typeof NEW_TEAM;

export default function TeamSwitcher() {
  const {
    teams, activeTeamId, activeTeam, setActiveTeamId,
    createTeam, updateTeam, deleteTeam, leaveTeam, toggleStarTeam, loading,
  } = useTeams();
  const route = useHashRoute();
  const { toastMessage, toastVisible, showToast } = useToast();

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
    // Активная группа всегда первой, затем избранные, затем остальные по алфавиту:
    // при длинном списке выбранную группу не приходится искать прокруткой.
    const rest = list.filter((t) => t.id !== activeTeamId);
    const active = list.filter((t) => t.id === activeTeamId);
    return [
      ...active,
      ...rest.filter((t) => t.isStarred).sort(byName),
      ...rest.filter((t) => !t.isStarred).sort(byName),
    ];
  }, [teams, query, activeTeamId]);

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
    setEditing(NEW_TEAM);
  }

  function boardCount(t: Team): number {
    return t.boardCount;
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
  const shownTeam = activeTeam ?? (!loading ? teams[0] ?? null : null);
  const showPlaceholder = loading && !activeTeam;
  const showCreateTrigger = !loading && teams.length === 0;

  // Устаревший activeTeamId (группы нет в списке) - переключаемся на первую.
  const fallbackId = !loading && !activeTeam && teams.length > 0 ? teams[0].id : null;
  useEffect(() => {
    if (fallbackId) setActiveTeamId(fallbackId);
  }, [fallbackId, setActiveTeamId]);

  return (
    <>
      <div className="team-switcher" ref={wrapRef}>
        {shownTeam ? (
          <button
            type="button"
            className="btn btn--ghost team-switcher__trigger"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Текущая группа: ${shownTeam.name}. Открыть список групп`}
            title={shownTeam.name}
          >
            <span className={`team-switcher__mark cover--${colorOf(shownTeam)}`} aria-hidden>
              {initialsOf(shownTeam.name)}
            </span>
            <span className="team-switcher__name">{shownTeam.name}</span>
            {ageLabel(shownTeam.ageGroup) && (
              <span className="team-switcher__age">{ageLabel(shownTeam.ageGroup)}</span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : showPlaceholder ? (
          <button type="button" className="btn btn--ghost team-switcher__trigger team-switcher__trigger--loading" disabled aria-busy="true">
            Группы…
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
                    <span className={`team-switcher__mark team-switcher__mark--lg cover--${colorOf(team)}`} aria-hidden>
                      {initialsOf(team.name)}
                    </span>
                    <span className="team-switcher__main">
                      <span className="team-switcher__item-name" title={team.name}>{team.name}</span>
                      <span className="team-switcher__sub">{subline(team)}</span>
                    </span>
                    <span className="team-switcher__icons" onClick={(e) => e.stopPropagation()}>
                      <StarToggle
                        isStarred={!!team.isStarred}
                        onToggle={() => toggleStarTeam(team.id)}
                        notify={showToast}
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
      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </>
  );
}
