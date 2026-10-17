import { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import "../components/Boards.css";
import "../components/BoardMenu.css";
import "../components/Boards.modals.css";
import "../components/Boards.list.css";
import BoardCover from "../components/BoardCover";
import StarButton from "../components/StarButton";
import MenuButton from "../components/MenuButton";
import MenuPortal from "../components/MenuPortal";
import ViewToggle from "../components/ViewToggle";
import GroupHeader from "../components/GroupHeader";
import TeamSettingsModal, { NEW_TEAM } from "../components/TeamSettingsModal";
import { useTeams } from "../contexts/TeamsContext";
import { useUser } from "../contexts/UserContext";
import { useToast } from "../hooks/useToast";
import { navigate } from "../hooks/useHashRoute";
import { assignColors } from "../utils/colors";
import { formatRelative } from "../utils/relativeTime";
import { colorForId } from "../utils/cover";
import { coverForBoard } from "../utils/templates";
import { matchesQuery, searchOtherTeams, type Segment } from "../utils/searchBoards";
import { openBoardWindow } from "../utils/openBoard";
import type { Team } from "../types";
import type { AgeKey } from "../constants/templates";

export default function BoardsPage() {
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    activeTeam,
    activeBoards,
    createBoard,
    createTeam,
    updateTeam,
    deleteTeam,
    leaveTeam,
    renameBoard,
    deleteBoard,
    toggleStarBoard,
    loading,
  } = useTeams();

  const { user } = useUser();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Режим отображения досок (grid/list) сохраняем в localStorage,
  // чтобы не сбрасывался на grid после перезагрузки.
  const [view, setView] = useState<"grid" | "list">(() => {
    try {
      const saved = localStorage.getItem("boards.view");
      return saved === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  useEffect(() => {
    try { localStorage.setItem("boards.view", view); } catch { /* ignore */ }
  }, [view]);
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);

  // Фильтры / сортировка панели "boards-toolbar".
  type SortBy = "last-opened" | "name" | "updated";
  const [segment, setSegment] = useState<Segment>("all");
  const [sortBy, setSortBy] = useState<SortBy>("last-opened");
  // Поисковый запрос не сохраняем между сессиями.
  const [q, setQ] = useState("");
  // Модалка настроек активной группы / создания новой.
  const [teamModal, setTeamModal] = useState<"edit" | "create" | null>(null);

  const { toastMessage, toastVisible, showToast } = useToast();

  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const menuCardRef = useRef<HTMLElement | null>(null);

  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const [menuPlacement, setMenuPlacement] = useState("left");


  const [dialog, setDialog] = useState<{ type: "rename" | "delete"; boardId: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Цвета назначаются по всей группе ДО фильтров, чтобы доска не меняла цвет при поиске/сегменте.
  const boards = useMemo(() => {
    let list = assignColors(activeBoards);

    // сегмент "Все / Мои / Избранные"
    if (segment === "starred") {
      list = list.filter((b) => b.isStarred);
    } else if (segment === "mine") {
      list = user.id ? list.filter((b) => b.ownerId === user.id) : [];
    }

    // поиск по названию
    if (q.trim()) {
      list = list.filter((b) => matchesQuery(b.title, q));
    }

    // сортировка
    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    } else {
      // last-opened и updated — по updatedAt desc (пока нет отдельного lastOpenedAt)
      sorted.sort((a, b) => {
        const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        return tb - ta;
      });
    }

    // избранные наверх (внутри каждой группы текущий sort сохраняется)
    const starred = sorted.filter((b) => b.isStarred);
    const others = sorted.filter((b) => !b.isStarred);
    return [...starred, ...others];
  }, [activeBoards, segment, q, sortBy, user.id]);

  const canCreateBoard = Boolean(activeTeamId);
  // Во время первого фетча опираемся на флаги из window.dashData, чтобы
  // не мигать empty-state у пользователей, у которых на самом деле данные есть.
  // После загрузки — реальное состояние из TeamsContext.
  const dashFlags = window.dashData;
  const userHasTeams = loading
    ? dashFlags?.hasTeams !== false
    : teams.length > 0;
  const selectedTeamHasBoards = loading
    ? dashFlags?.hasBoards !== false
    : Boolean(activeTeam && activeBoards.length > 0);
  const colouredByTeam = useMemo(
    () => new Map(teams.map((t) => [t.id, assignColors(t.boards)])),
    [teams],
  );
  const otherMatches = useMemo(
    () =>
      searchOtherTeams(teams, activeTeamId, q).map(({ board, team }) => ({
        board: colouredByTeam.get(team.id)?.find((b) => b.id === board.id) ?? board,
        team,
      })),
    [teams, activeTeamId, q, colouredByTeam],
  );

  const handleStarClick = (board: { id: string; isStarred?: boolean }) => {
    const willStar = !board.isStarred;
    void toggleStarBoard(board.id);
    showToast(willStar ? "Доска добавлена в избранное" : "Убрана из избранного");
  };

  const handleCreateBoard = () => {
    void (async () => {
      const newBoard = await createBoard("Новая доска");
      if (newBoard) {
        showToast("Доска создана");
        openBoardWindow(newBoard);
      } else {
        showToast("Не удалось создать доску");
      }
    })();
  };

  const openRenameDialog = (board: { id: string; title: string }) => {
    setRenameDraft(board.title);
    setDialog({ type: "rename", boardId: board.id });
    closeMenu();
  };

  const openDeleteDialog = (board: { id: string }) => {
    setDialog({ type: "delete", boardId: board.id });
    closeMenu();
  };

  const closeDialog = () => { setDialog(null); setRenameDraft(""); };

  const handleRenameConfirm = () => {
    if (!dialog || dialog.type !== "rename") return;
    const value = renameDraft.trim();
    if (!value) { closeDialog(); return; }
    void renameBoard(dialog.boardId, value)
      .then(() => showToast("Доска переименована"))
      .catch(() => showToast("Не удалось переименовать"));
    closeDialog();
  };

  const handleDeleteConfirm = () => {
    if (!dialog || dialog.type !== "delete") return;
    const id = dialog.boardId;
    void deleteBoard(id)
      .then(() => showToast("Доска удалена"))
      .catch(() => showToast("Не удалось удалить"));

    try {
      if (menuAnchorRef.current && (menuAnchorRef.current as HTMLElement).dataset.boardId === id) {
        menuAnchorRef.current = null;
      }
    } catch {}
    closeMenu();
    closeDialog();
  };

  function closeMenu() {
    setMenuBoardId(null);
    menuCardRef.current = null;
    setMenuStyle(null);
    try {
      if (menuAnchorRef.current && typeof menuAnchorRef.current.blur === "function") {
        menuAnchorRef.current.blur();
      }
    } catch {}
    menuAnchorRef.current = null;
  }

  const handleMenuToggle = (id: string) => {
    setMenuBoardId((prev) => {
      const next = prev === id ? null : id;
      if (next === null) {
        setMenuPlacement("left");
        menuCardRef.current = null;
        setMenuStyle(null);
        if (menuAnchorRef.current && typeof menuAnchorRef.current.blur === "function") {
          try { menuAnchorRef.current.blur(); } catch {}
        }
        menuAnchorRef.current = null;
      }
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!menuBoardId) { setMenuStyle(null); return; }
    let raf = 0;
    function update() {
      const anchor = menuAnchorRef.current;
      const menuEl = menuRef.current;
      const cardEl = document.querySelector(`[data-board-id="${menuBoardId}"]`);
      if (!anchor || !menuEl || !cardEl) {
        raf = requestAnimationFrame(update);
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = Math.round(anchorRect.left - menuRect.width - margin);
      let top = Math.round(anchorRect.top + (anchorRect.height / 2) - (menuRect.height / 2));
      let placement = "left";

      if (left < margin) {
        const rightLeft = Math.round(anchorRect.right + margin);
        if (rightLeft + menuRect.width <= vw - margin) {
          left = rightLeft;
          placement = "right";
        } else {
          const topCandidate = Math.round(anchorRect.top - menuRect.height - margin);
          const bottomCandidate = Math.round(anchorRect.bottom + margin);
          if (topCandidate >= margin) {
            top = topCandidate;
            left = Math.round(anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2));
            placement = "top";
          } else {
            top = bottomCandidate;
            left = Math.round(anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2));
            placement = "bottom";
          }
        }
      }

      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      left = clamp(left, margin, Math.max(margin, vw - menuRect.width - margin));
      top = clamp(top, margin, Math.max(margin, vh - menuRect.height - margin));

      setMenuPlacement(placement);
      setMenuStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 2147483000,
      });
    }
    raf = requestAnimationFrame(update);
    function onResize() { requestAnimationFrame(update); }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [menuBoardId]);

  useEffect(() => {
    function isEventInside(event: Event, element: HTMLElement | null) {
      if (!event || !element) return false;
      if (event.composedPath) {
        return event.composedPath().indexOf(element) !== -1;
      }
      return element.contains ? element.contains(event.target as Node) : false;
    }

    function handleClickOutside(e: Event) {
      if (menuBoardId) {
        const menuEl = menuRef.current;
        const anchorEl = menuAnchorRef.current;
        if (!isEventInside(e, menuEl) && !isEventInside(e, anchorEl)) {
          closeMenu();
        }
      }
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [menuBoardId]);

  const renderContextMenu = (b: { id: string; title: string }, variant: "grid" | "list") => (
    <div
      ref={menuRef}
      className={`board-card-menu${variant === "list" ? " board-card-menu--list" : ""}`}
      style={menuStyle || {}}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="board-card-menu-item" onClick={() => { console.log("Share", b.id); }}><span className="board-card-menu-icon">↗︎</span><span className="board-card-menu-label">Поделиться</span></button>
      <button type="button" className="board-card-menu-item" onClick={() => { console.log("Copy link", b.id); }}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
      <button type="button" className="board-card-menu-item" onClick={() => { console.log("Open in new tab", b.id); }}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
      <div className="board-card-menu-separator" />
      <button type="button" className="board-card-menu-item" onClick={() => console.log("Info", b.id)}><span className="board-card-menu-icon">ⓘ</span><span className="board-card-menu-label">Инфо</span></button>
      <button type="button" className="board-card-menu-item" onClick={() => openRenameDialog(b)}><span className="board-card-menu-icon">✎</span><span className="board-card-menu-label">Переименовать</span></button>
      <div className="board-card-menu-separator" />
      <button type="button" className="board-card-menu-item board-card-menu-item--danger" onClick={() => openDeleteDialog(b)}><span className="board-card-menu-icon">🗑</span><span className="board-card-menu-label">Удалить</span></button>
    </div>
  );

  return (
    <main className="page boards-page">
      <div className="boards-wrapper">
        {(!loading || activeTeam) && (
          <GroupHeader
            team={activeTeam ?? null}
            boardsCount={activeTeam ? (loading ? (activeTeam.boardCount ?? 0) : activeTeam.boards.length) : 0}
            role={activeTeam?.role ?? "member"}
            onSettings={() => setTeamModal("edit")}
            onFromTemplate={() => navigate({ name: "templates", age: activeTeam?.ageGroup || undefined })}
            onCreateBoard={handleCreateBoard}
            onCreateTeam={() => setTeamModal("create")}
          />
        )}

        {/* If user has no teams, show minimal centered hint */}
        {!userHasTeams ? null : !selectedTeamHasBoards ? (
          <div className="boards-team-empty-hint" role="status" aria-live="polite">
            <p className="boards-team-empty-hint__text">В этой группе пока нет досок. Создайте первую доску, чтобы начать работу вместе.</p>
          </div>
        ) : (
          <>
            <div className="boards-toolbar">
              <div className="boards-toolbar__title">
                <h2 className="boards-toolbar__heading">Доски группы</h2>
                <span className="chip chip--muted">{boards.length}</span>
              </div>
              <div className="boards-toolbar__spacer" />
              <label className={`input input--search boards-search${q ? " boards-search--filled" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={q}
                  placeholder="Найти доску…"
                  aria-label="Найти доску"
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); } }}
                />
                {q && (
                  <button type="button" className="input__clear" aria-label="Очистить поиск" onClick={() => setQ("")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </label>
              <div className="seg" role="group" aria-label="Показать доски">
                {([["all", "Все"], ["mine", "Мои"], ["starred", "Избранные"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`seg__btn${segment === key ? " seg__btn--on" : ""}`}
                    aria-pressed={segment === key}
                    onClick={() => setSegment(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">Сортировка</span>
                <select
                  className="filter-select"
                  aria-label="Сортировка"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                >
                  <option value="last-opened">Недавние</option>
                  <option value="name">По названию</option>
                  <option value="updated">По дате изменения</option>
                </select>
              </div>
              <div className="boards-view-toggle"><ViewToggle view={view} setView={setView} /></div>
            </div>

            {boards.length === 0 ? (
              <div className="boards-team-empty-hint" role="status" aria-live="polite">
                <p className="boards-team-empty-hint__text">
                  {q.trim()
                    ? `В группе «${activeTeam?.name ?? ""}» ничего не найдено по запросу «${q.trim()}».`
                    : "По выбранному фильтру досок нет. Создайте новую или снимите фильтр."}
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="boards-grid">
                {boards.map((b) => {
                  const isStarred = b.isStarred ?? false;
                  const isMenuOpen = menuBoardId === b.id;
                  const cover = coverForBoard(b);
                  return (
                    <div
                      key={b.id}
                      className={`board-card ${isMenuOpen ? "board-card--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                      data-board-id={b.id}
                      ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}
                      onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                      onClick={() => openBoardWindow(b)}
                    >
                      <BoardCover board={b} size="card" />

                      <div className="board-info">
                        <div className="board-info-text">
                          <button
                            type="button"
                            className="board-title"
                            title={b.title}
                            onClick={(e) => { e.stopPropagation(); openBoardWindow(b); }}
                          >
                            {b.title}
                          </button>
                          <span className="visually-hidden">
                            Владелец: {b.owner}.{cover.topic ? ` Тема: ${cover.topic.label}.` : ""}
                          </span>
                          <div className="board-sub">Изменено: {formatRelative(b.updatedAt, now)}</div>
                        </div>
                        <div className="board-card-actions" onClick={(e) => e.stopPropagation()}>
                          <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="grid" />
                          <div className="board-menu-wrapper">
                            <MenuButton
                              variant="grid"
                              onClick={(e) => {
                                e.stopPropagation();
                                try { (e.currentTarget as HTMLElement).dataset.boardId = String(b.id); } catch {}
                                menuAnchorRef.current = e.currentTarget;
                                setMenuPlacement("left");
                                handleMenuToggle(b.id);
                              }}
                            />
                            {menuBoardId === b.id && (
                              <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} onClose={closeMenu}>
                                {renderContextMenu(b, "grid")}
                              </MenuPortal>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="boards-list">
                <div className="boards-list-header" role="row">
                  <div>Название</div>
                  <div style={{ textAlign: "center" }} aria-hidden></div>
                  <div style={{ textAlign: "center" }}>Последнее открытие</div>
                  <div style={{ textAlign: "left" }}>Владелец</div>
                  <div style={{ textAlign: "right" }} aria-hidden> </div>
                </div>

                {boards.map((b, index) => {
                  const isStarred = b.isStarred ?? false;
                  const isMenuOpen = menuBoardId === b.id;
                  const isLastRow = index === boards.length - 1;
                  const cover = coverForBoard(b);
                  return (
                    <div
                      key={b.id}
                      data-board-id={b.id}
                      className={`boards-list-row ${isMenuOpen ? "boards-list-row--menu-open" : ""}`}
                      onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                    >
                      <div className="boards-name-cell" onClick={() => openBoardWindow(b)}>
                        <BoardCover board={b} size="small" />
                        <div className="boards-name-text">
                          <div className="board-row-title">{b.title}</div>
                          {cover.topic && (
                            <div className="board-row-topic" style={{ color: cover.topic.color }}>{cover.topic.label}</div>
                          )}
                          <div className="board-row-sub">Изменено: {b.owner}, {formatRelative(b.updatedAt, now)}</div>
                        </div>
                      </div>

                      <div className="boards-col" style={{ textAlign: "center" }} aria-hidden> </div>
                      <div className="boards-col" style={{ textAlign: "center" }}>{b.lastOpened}</div>
                      <div className="boards-col owner" style={{ textAlign: "left" }}>{b.owner}</div>

                      <div className="boards-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <div onClick={(e) => { e.stopPropagation(); }}>
                          <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="list" />
                        </div>

                        <div style={{ position: "relative" }} className="board-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                          <MenuButton
                            variant="list"
                            onClick={(e) => {
                              e.stopPropagation();
                              try { (e.currentTarget as HTMLElement).dataset.boardId = String(b.id); } catch {}
                              menuAnchorRef.current = e.currentTarget;
                              const forceTop = isLastRow;
                              setMenuPlacement(forceTop ? "top" : "left");
                              handleMenuToggle(b.id);
                            }}
                          />

                          {menuBoardId === b.id && (
                            <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} onClose={closeMenu}>
                              {renderContextMenu(b, "list")}
                            </MenuPortal>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {otherMatches.length > 0 && (
              <section className="boards-other" aria-label="Совпадения в других группах">
                <h3 className="boards-other__title">Ещё {otherMatches.length} в других группах</h3>
                <ul className="boards-other__list">
                  {otherMatches.map(({ board, team }) => (
                    <li key={board.id} className="boards-other__row card">
                      <BoardCover board={board} size="small" />
                      <div className="boards-other__text">
                        <div className="boards-other__name">{board.title}</div>
                        <div className="boards-other__sub">
                          {board.owner} · {formatRelative(board.updatedAt, now)}
                        </div>
                      </div>
                      <span className="chip chip--muted boards-other__team">
                        <span className={`boards-other__swatch cover--${colorForId(team.id)}`} aria-hidden="true" />
                        {team.name}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setActiveTeamId(team.id)}
                        aria-label={`Перейти в группу «${team.name}»`}
                      >
                        Перейти в группу
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        {toastVisible && <div className="boards-toast">{toastMessage}</div>}
      </div>

      {teamModal && (teamModal === "create" || activeTeam) && (
        <TeamSettingsModal
          team={teamModal === "create" ? NEW_TEAM : activeTeam!}
          onClose={() => setTeamModal(null)}
          onSave={async (teamId, { name, ageGroup }) => {
            try {
              if (teamModal === "create") {
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

      {dialog?.type === "rename" && (
        <div
          className="boards-modal-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="boards-modal-header">
              <h3 className="boards-modal-title">Переименовать доску</h3>
              <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={closeDialog}>×</button>
            </div>
            <div className="boards-modal-body">
              <input
                className={`boards-modal-input ${renameDraft.trim() === "" ? "boards-modal-input--empty" : ""}`}
                value={renameDraft}
                autoFocus
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameConfirm(); if (e.key === "Escape") closeDialog(); }}
                aria-label="Новое имя доски"
                aria-invalid={renameDraft.trim() === ""}
                placeholder="Название доски"
              />
            </div>
            <div className="boards-modal-footer">
              <button
                type="button"
                className="primary-btn"
                onClick={handleRenameConfirm}
                disabled={renameDraft.trim() === ""}
                aria-disabled={renameDraft.trim() === ""}
              >
                Сохранить
              </button>
              <button type="button" className="secondary-btn" onClick={closeDialog}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {dialog?.type === "delete" && (
        <div
          className="boards-modal-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="boards-modal-header">
              <h3 className="boards-modal-title">Удалить доску?</h3>
              <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={closeDialog}>×</button>
            </div>
            <div className="boards-modal-body">
              <p>Это приведет к удалению <strong>{boards.find((x) => x.id === dialog.boardId)?.title}</strong>.</p>
            </div>
            <div className="boards-modal-footer">
              <button type="button" className="danger-btn" onClick={handleDeleteConfirm}>Удалить</button>
              <button type="button" className="secondary-btn" onClick={closeDialog}>Отмена</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
