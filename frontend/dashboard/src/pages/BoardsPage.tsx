import { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { readPrefIn, savePrefs } from "../utils/prefs";
import "../components/Boards.css";
import "../components/BoardMenu.css";
import "../components/Boards.modals.css";
import "../components/Boards.list.css";
import BoardCover from "../components/BoardCover";
import StarToggle from "../components/StarToggle";
import MenuButton from "../components/MenuButton";
import { Modal } from "../components/Modal";
import { shortName } from "../utils/shortName";
import MenuPortal from "../components/MenuPortal";
import ViewToggle from "../components/ViewToggle";
import GroupHeader from "../components/GroupHeader";
import TeamSettingsModal, { NEW_TEAM } from "../components/TeamSettingsModal";
import TemplateSettingsModal, { NEW_TEMPLATE } from "../components/TemplateSettingsModal";
import { useTeams } from "../contexts/TeamsContext";
import { useTemplates } from "../contexts/TemplatesContext";
import { useUser } from "../contexts/UserContext";
import { useToast } from "../hooks/useToast";
import { navigate } from "../hooks/useHashRoute";
import { assignColors, colorOf } from "../utils/colors";
import { formatRelative } from "../utils/relativeTime";
import { coverForBoard } from "../utils/templates";
import { matchesQuery, searchOtherTeams, type Segment } from "../utils/searchBoards";
import { openBoard, openInNewTab, boardUrl } from "../utils/openBoard";
import type { BoardAccess, Team } from "../types";
import type { AgeKey } from "../constants/templates";

export default function BoardsPage() {
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    activeTeam,
    activeBoards,
    createBoard,
    markBoardOpened,
    createTeam,
    updateTeam,
    deleteTeam,
    leaveTeam,
    renameBoard,
    deleteBoard,
    toggleStarBoard,
    loading,
  } = useTeams();
  const { teams: allTeams, activeTeamId: currentTeamId, duplicateBoard, moveBoard, updateBoardAccess } = useTeams();
  const { byId: byTemplateId, createTemplate } = useTemplates();

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

  // Режим (сетка/список) и сортировка живут в настройках аккаунта и приходят в dashData.
  const [view, setViewState] = useState<"grid" | "list">(() => readPrefIn("boards.view", ["grid", "list"], "grid"));
  const setView = (v: "grid" | "list") => { setViewState(v); savePrefs({ "boards.view": v }); };
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);

  // Фильтры / сортировка панели "boards-toolbar".
  type SortBy = "recent" | "updated" | "name";
  const SORT_LABELS: Record<SortBy, string> = {
    recent: "Недавние",
    updated: "По дате изменения",
    name: "По названию",
  };
  const [segment, setSegment] = useState<Segment>("all");
  const [sortBy, setSortByState] = useState<SortBy>(() => readPrefIn("boards.sort", ["recent", "updated", "name"], "recent"));
  const setSortBy = (v: SortBy) => { setSortByState(v); savePrefs({ "boards.sort": v }); };
  // true, если взаимодействие с селектом сортировки началось с мыши/тача
  const sortByPointer = useRef(false);
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


  const [dialog, setDialog] = useState<{ type: "rename" | "delete" | "move" | "access"; boardId: string } | null>(null);
  const otherTeams = allTeams.filter((t) => t.id !== currentTeamId);
  const [saveAsTemplate, setSaveAsTemplate] = useState<{ id: string; title: string; templateId?: string } | null>(null);
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
      // recent - по lastOpenedAt desc (фолбэк updatedAt); updated - по updatedAt desc
      const ts = (iso?: string) => (iso ? Date.parse(iso) : 0);
      const key = (x: (typeof sorted)[number]) =>
        sortBy === "recent" ? ts(x.lastOpenedAt || x.updatedAt) : ts(x.updatedAt);
      sorted.sort((a, b) => key(b) - key(a));
    }

    // Избранные не закрепляются наверху: порядок задаёт только сортировка,
    // а избранное смотрят через сегмент «Избранные».
    return sorted;
  }, [activeBoards, segment, q, sortBy, user.id]);

  const canCreateBoard = Boolean(activeTeamId);
  // Во время первого фетча опираемся на флаги из window.dashData, чтобы
  // не мигать empty-state у пользователей, у которых на самом деле данные есть.
  // После загрузки - реальное состояние из TeamsContext.
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

  // Звезда на карточке и в списке - общий StarToggle с нейтральными тостами

  const handleCreateBoard = () => {
    void (async () => {
      const newBoard = await createBoard("Новая доска");
      if (newBoard) {
        showToast("Доска создана");
        markBoardOpened(newBoard.id);
        openBoard(newBoard);
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

  // Список: при сортировке «Недавние» две секции, иначе одна без заголовка.
  const listSections = useMemo(() => {
    if (sortBy !== "recent") return [{ key: "all", title: "", items: boards }];
    const weekAgo = now.getTime() - 7 * 86_400_000;
    const ts = (iso?: string) => (iso ? new Date(iso).getTime() : 0);
    const recent = boards.filter((b) => ts(b.lastOpenedAt || b.updatedAt) >= weekAgo);
    const older = boards.filter((b) => ts(b.lastOpenedAt || b.updatedAt) < weekAgo);
    if (!recent.length || !older.length) return [{ key: "all", title: "", items: boards }];
    return [
      { key: "recent", title: "На этой неделе", items: recent },
      { key: "older", title: "Раньше", items: older },
    ];
  }, [boards, sortBy, now]);

  const openAccessDialog = (board: { id: string }) => {
    setDialog({ type: "access", boardId: board.id });
    closeMenu();
  };

  const handleAccessChange = (boardId: string, patch: { teamAccess?: BoardAccess; linkAccessEnabled?: boolean }) => {
    void updateBoardAccess(boardId, patch).catch(() => showToast("Не удалось изменить доступ"));
  };

  const handleCopyLink = (board: { publicId: string }) => {
    closeMenu();
    const url = `${window.location.origin}${boardUrl(board)}`;
    navigator.clipboard?.writeText(url)
      .then(() => showToast("Ссылка скопирована"))
      .catch(() => showToast("Не удалось скопировать ссылку"));
  };

  const handleDuplicate = (board: { id: string }) => {
    closeMenu();
    void duplicateBoard(board.id).then((copy) => showToast(copy ? "Копия создана" : "Не удалось дублировать"));
  };

  const openMoveDialog = (board: { id: string }) => {
    setDialog({ type: "move", boardId: board.id });
    closeMenu();
  };

  const handleMoveTo = (team: { id: string; name: string }) => {
    if (!dialog || dialog.type !== "move") return;
    void moveBoard(dialog.boardId, team.id)
      .then(() => showToast(`Доска перенесена в "${team.name}"`))
      .catch(() => showToast("Не удалось перенести"));
    closeDialog();
  };

  const openSaveAsTemplate = (board: { id: string; title: string; templateId?: string }) => {
    setSaveAsTemplate(board);
    closeMenu();
  };

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

      // Кнопка в углу обложки: меню вниз, правым краем по кнопке; если не помещается, вверх.
      const inCorner = !!anchor.closest(".board-card__corner");
      if (inCorner) {
        left = Math.round(anchorRect.right - menuRect.width);
        const below = Math.round(anchorRect.bottom + 4);
        if (below + menuRect.height <= vh - margin) {
          top = below;
          placement = "bottom";
        } else {
          top = Math.round(anchorRect.top - menuRect.height - 4);
          placement = "top";
        }
      } else if (left < margin) {
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

  const renderContextMenu = (b: { id: string; publicId: string; title: string; templateId?: string; canEdit?: boolean }, variant: "grid" | "list") => (
    <div
      ref={menuRef}
      className={`board-card-menu${variant === "list" ? " board-card-menu--list" : ""}`}
      style={menuStyle || {}}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="board-card-menu-item" onClick={() => handleCopyLink(b)}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
      <button type="button" className="board-card-menu-item" disabled={!b.canEdit} aria-disabled={!b.canEdit} onClick={() => openAccessDialog(b)}><span className="board-card-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.6 0 4.5 1.8 4.5 4.5" /></svg></span><span className="board-card-menu-label">Доступ</span></button>
      <button type="button" className="board-card-menu-item" onClick={() => { closeMenu(); markBoardOpened(b.id); openInNewTab(boardUrl(b)); }}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
      <div className="board-card-menu-separator" />
      <button type="button" className="board-card-menu-item" disabled={!b.canEdit} aria-disabled={!b.canEdit} onClick={() => openRenameDialog(b)}><span className="board-card-menu-icon">✎</span><span className="board-card-menu-label">Переименовать</span></button>
      <button type="button" className="board-card-menu-item" onClick={() => handleDuplicate(b)}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Дублировать</span></button>
      <button type="button" className="board-card-menu-item" disabled={!b.canEdit || otherTeams.length === 0} aria-disabled={!b.canEdit || otherTeams.length === 0} onClick={() => openMoveDialog(b)}><span className="board-card-menu-icon">⊞</span><span className="board-card-menu-label">Перенести в группу</span></button>
      <button type="button" className="board-card-menu-item" onClick={() => openSaveAsTemplate(b)}><span className="board-card-menu-icon">▦</span><span className="board-card-menu-label">Сохранить как шаблон</span></button>
      <div className="board-card-menu-separator" />
      <button type="button" className="board-card-menu-item board-card-menu-item--danger" disabled={!b.canEdit} aria-disabled={!b.canEdit} onClick={() => openDeleteDialog(b)}><span className="board-card-menu-icon">🗑</span><span className="board-card-menu-label">Удалить</span></button>
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
              {/* Невидимый select накрывает всю пилюлю: клик в любое место открывает список */}
              <div className="sort-control" title="Сортировка">
                <svg className="sort-control__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
                  <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
                </svg>
                <span className="sort-control__value" aria-hidden="true">{SORT_LABELS[sortBy]}</span>
                <svg className="sort-control__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
                <select
                  className="sort-control__select"
                  aria-label="Сортировка"
                  value={sortBy}
                  onPointerDown={() => { sortByPointer.current = true; }}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortBy);
                    // После выбора мышью снимаем фокус, чтобы рамка не держалась на кнопке;
                    // при выборе с клавиатуры фокус остаётся.
                    if (sortByPointer.current) {
                      sortByPointer.current = false;
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={() => { sortByPointer.current = false; }}
                >
                  <option value="recent">{SORT_LABELS.recent}</option>
                  <option value="updated">{SORT_LABELS.updated}</option>
                  <option value="name">{SORT_LABELS.name}</option>
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
                  const tpl = byTemplateId(b.templateId);
                  const cover = coverForBoard(b, tpl);
                  return (
                    <div
                      key={b.id}
                      className={`board-card ${isMenuOpen ? "board-card--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                      data-board-id={b.id}
                      ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}
                      onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                      onClick={(e) => { markBoardOpened(b.id); openBoard(b, e); }}
                      onAuxClick={(e) => { if (e.button === 1) { markBoardOpened(b.id); openInNewTab(boardUrl(b)); } }}
                    >
                      <BoardCover board={b} size="card" template={tpl} />
                      {isStarred && <span className="card-star-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z" /></svg></span>}

                      <span className="board-card__corner" onClick={(e) => e.stopPropagation()}>
                        <StarToggle isStarred={isStarred} onToggle={() => toggleStarBoard(b.id)} notify={showToast} variant="list" />
                        <span className="board-menu-wrapper">
                          <MenuButton
                            variant="list"
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
                        </span>
                      </span>

                      <div className="board-info">
                        <div className="board-info-text">
                          <a
                            className="board-title"
                            href={boardUrl(b)}
                            title={b.title}
                            onClick={(e) => { e.stopPropagation(); markBoardOpened(b.id); }}
                          >
                            {b.title}
                          </a>
                          {cover.topic && <span className="visually-hidden">Тема: {cover.topic.label}.</span>}
                          <div className="board-sub" title={`Изменено: ${formatRelative(b.updatedAt, now)}, ${b.owner}`}>{formatRelative(b.updatedAt, now)} · {shortName(b.owner)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="boards-list">
                {listSections.map((sec) => (
                  <section key={sec.key} className="boards-list__section">
                    {sec.title && <h3 className="boards-list__title">{sec.title}</h3>}
                    <div className="boards-list__grid">
                      {sec.items.map((b) => {
                        const isStarred = b.isStarred ?? false;
                        const isMenuOpen = menuBoardId === b.id;
                        const tpl = byTemplateId(b.templateId);
                        return (
                          <div
                            key={b.id}
                            data-board-id={b.id}
                            className={`board-row ${isMenuOpen ? "board-row--menu-open" : ""} ${isStarred ? "board-row--starred" : ""}`}
                            onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                            onClick={(e) => { markBoardOpened(b.id); openBoard(b, e); }}
                            onAuxClick={(e) => { if (e.button === 1) { markBoardOpened(b.id); openInNewTab(boardUrl(b)); } }}
                          >
                            <BoardCover board={b} size="small" template={tpl} />
                            {isStarred && <span className="card-star-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z" /></svg></span>}
                            <div className="board-row__text">
                              <a
                                className="board-row-title"
                                href={boardUrl(b)}
                                title={b.title}
                                onClick={(e) => { e.stopPropagation(); markBoardOpened(b.id); }}
                              >
                                {b.title}
                              </a>
                              <div className="board-row-sub" title={`Изменено: ${formatRelative(b.updatedAt, now)}, ${b.owner}`}>{formatRelative(b.updatedAt, now)} · {shortName(b.owner)}</div>
                            </div>
                            <div className="board-row__actions" onClick={(e) => e.stopPropagation()}>
                              <StarToggle isStarred={isStarred} onToggle={() => toggleStarBoard(b.id)} notify={showToast} variant="list" />
                              <div style={{ position: "relative" }} className="board-menu-wrapper">
                                <MenuButton
                                  variant="list"
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
                                    {renderContextMenu(b, "list")}
                                  </MenuPortal>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
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
                        <span className={`boards-other__swatch cover--${colorOf(team)}`} aria-hidden="true" />
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
          onSave={async (teamId, { name, ageGroup, teachers }) => {
            try {
              if (teamModal === "create") {
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

      {saveAsTemplate && (
        <TemplateSettingsModal
          template={NEW_TEMPLATE}
          initial={{
            name: saveAsTemplate.title,
            ages: activeTeam?.ageGroup ? [activeTeam.ageGroup] : [],
            topic: byTemplateId(saveAsTemplate.templateId)?.topic ?? "math",
            durationMin: 20,
          }}
          onClose={() => setSaveAsTemplate(null)}
          onSave={async (input) => {
            try {
              await createTemplate(input, saveAsTemplate.id);
            } catch (e) {
              showToast("Не удалось сохранить шаблон");
              throw e;
            }
            showToast("Шаблон сохранён");
            navigate({ name: "templates" });
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

      {dialog?.type === "access" && (() => {
        const board = boards.find((x) => x.id === dialog.boardId);
        if (!board) return null;
        const access = board.teamAccess ?? "edit";
        const accessHint: Record<BoardAccess, string> = {
          edit: "Все участники группы рисуют на доске",
          view: "Участники открывают доску без права правки",
          deny: "Доска видна только вам и администраторам группы",
        };
        return (
          <Modal isOpen onClose={closeDialog} title="Доступ к доске">
            <div className="boards-modal-body">
              <div className="ts-section">
                <label className="field-label ts-section-label" htmlFor="board-access-team">Участники группы</label>
                <select
                  id="board-access-team"
                  className="boards-modal-input"
                  value={access}
                  onChange={(e) => handleAccessChange(board.id, { teamAccess: e.target.value as BoardAccess })}
                >
                  <option value="edit">Редактируют</option>
                  <option value="view">Только смотрят</option>
                  <option value="deny">Не видят</option>
                </select>
                <p className="ts-section-text">{accessHint[access]}</p>
              </div>
              <div className="ts-section">
                <label className="field-label ts-section-label" htmlFor="board-access-link">Доступ по ссылке</label>
                <select
                  id="board-access-link"
                  className="boards-modal-input"
                  value={board.linkAccessEnabled ? "view" : "off"}
                  onChange={(e) => handleAccessChange(board.id, { linkAccessEnabled: e.target.value === "view" })}
                >
                  <option value="off">Выключен</option>
                  <option value="view">Только просмотр</option>
                </select>
                <p className="ts-section-text">
                  {board.linkAccessEnabled ? "Любой вошедший откроет доску по ссылке, но править не сможет" : "Доску открывают только участники группы"}
                </p>
              </div>
            </div>
            <div className="boards-modal-footer">
              <button type="button" className="primary-btn" onClick={closeDialog}>Готово</button>
              <button type="button" className="secondary-btn" onClick={() => { closeDialog(); handleCopyLink(board); }}>Скопировать ссылку</button>
            </div>
          </Modal>
        );
      })()}

      {dialog?.type === "move" && (
        <div
          className="boards-modal-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="boards-modal-header">
              <h3 className="boards-modal-title">Перенести доску</h3>
              <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={closeDialog}>×</button>
            </div>
            <div className="boards-modal-body">
              <p>Куда перенести <strong>{boards.find((x) => x.id === dialog.boardId)?.title}</strong>?</p>
              <div className="boards-modal-options" role="list">
                {otherTeams.map((t) => (
                  <button key={t.id} type="button" role="listitem" className="boards-modal-option" onClick={() => handleMoveTo(t)}>{t.name}</button>
                ))}
              </div>
            </div>
            <div className="boards-modal-footer">
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
