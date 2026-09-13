import { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import "./Boards.css";
import "./Boards.colors.css";
import "./BoardMenu.css";
import "./Boards.modals.css";
import "./Boards.list.css";
import StarButton from "./StarButton";
import MenuButton from "./MenuButton";
import ProfileMenu from "./ProfileMenu";
import ProfileModal from "./ProfileModal";
import MenuPortal from "./MenuPortal";
import NotificationsPanel from "./NotificationsPanel";
import TemplatesIsland, { Template } from "./TemplatesIsland";
import NotificationButton from "./NotificationButton";
import ProfileButton from "./ProfileButton";
import ViewToggle from "./ViewToggle";
import { useTeams } from "../contexts/TeamsContext";
import { useUser } from "../contexts/UserContext";
import { useToast } from "../hooks/useToast";
import { COLOR_KEYS, assignColors } from "../utils/colors";

function openBoardWindow(board: { publicId: string }) {
  const url = `/app/board/${encodeURIComponent(board.publicId)}`;
  const w = window.open(url, "_blank");
  if (!w) {
    alert("Пожалуйста, разрешите всплывающие окна для этого сайта.");
    return;
  }
  try { w.focus(); } catch {}
}

export default function Boards() {
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    activeTeam,
    activeBoards,
    createBoard,
    renameBoard,
    deleteBoard,
    toggleStarBoard,
    loading,
  } = useTeams();

  const { user, setUser, updateName, userInitial } = useUser();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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
  type BoardFilter = "all" | "starred";
  type OwnerFilter = "anyone" | "me";
  type SortBy = "last-opened" | "name" | "updated";
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("anyone");
  const [sortBy, setSortBy] = useState<SortBy>("last-opened");

  const { toastMessage, toastVisible, showToast } = useToast();

  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const menuCardRef = useRef<HTMLElement | null>(null);

  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const [menuPlacement, setMenuPlacement] = useState("left");

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notificationsAnchorRef = useRef<HTMLElement | null>(null);

  const [dialog, setDialog] = useState<{ type: "rename" | "delete"; boardId: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const boards = useMemo(() => {
    let list = activeBoards;

    // фильтр "Все / Избранное"
    if (filter === "starred") {
      list = list.filter((b) => b.isStarred);
    }

    // фильтр по владельцу
    if (ownerFilter === "me" && user.id) {
      list = list.filter((b) => b.ownerId === user.id);
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
    return assignColors([...starred, ...others]);
  }, [activeBoards, filter, ownerFilter, sortBy, user.id]);

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
  const filtersActive = filter !== "all" || ownerFilter !== "anyone";

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
      }
    })();
  };

  const handleTemplateClick = (template: Template) => {
    const title = `${template.title} (шаблон)`;
    void (async () => {
      const newBoard = await createBoard(title);
      if (newBoard) {
        showToast(`Доска создана из шаблона «${template.title}»`);
        openBoardWindow(newBoard);
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
      if (isNotificationsOpen) {
        const notifEl = notificationsRef.current;
        const notifAnchorEl = notificationsAnchorRef.current;
        if (!isEventInside(e, notifEl) && !isEventInside(e, notifAnchorEl)) {
          setIsNotificationsOpen(false);
        }
      }
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu();
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [menuBoardId, isNotificationsOpen]);

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
    <div className="boards-page">
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo-wrap">
            <span className="topbar-logo">Blanko</span>
            <span className="topbar-badge">Free</span>
          </div>
        </div>

        <div className="topbar-center" aria-hidden />

        <div className="topbar-right">
          <NotificationButton
            unreadCount={unreadCount}
            onClick={(e) => {
              notificationsAnchorRef.current = e.currentTarget;
              setIsNotificationsOpen((v) => !v);
            }}
          />

          <ProfileButton userInitial={userInitial} onClick={() => setIsProfileMenuOpen((prev) => !prev)} />

          {isProfileMenuOpen && (
            <ProfileMenu
              name={user.name || "Пользователь"}
              email={user.email || "user@example.com"}
              onSettings={() => {
                setIsProfileMenuOpen(false);
                setIsProfileModalOpen(true);
              }}
              onLogout={() => {
                window.location.href = "/app/logout";
              }}
              onClose={() => setIsProfileMenuOpen(false)}
            />
          )}
        </div>
      </header>

      <NotificationsPanel ref={notificationsRef} isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

      <div className="topbar-divider" />

      <TemplatesIsland onTemplateClick={handleTemplateClick} />

      <div className="templates-bottom-divider" />

      <div className="boards-wrapper">
        <div className="boards-header-line">
          <button
            type="button"
            className={`primary-btn create-btn ${!canCreateBoard ? "disabled" : ""}`}
            onClick={() => { if (!canCreateBoard) return; handleCreateBoard(); }}
            disabled={!canCreateBoard}
            aria-disabled={!canCreateBoard}
            title={!canCreateBoard ? "Нельзя создавать доски без выбранной команды" : "Создать доску"}
          >
            + Создать доску
          </button>
        </div>

        {/* If user has no teams, show minimal centered hint */}
        {!userHasTeams ? (
          <div className="boards-empty-hint" role="status" aria-live="polite">
            <p className="boards-empty-hint__text">Чтобы создавать доски, создайте команду или присоединитесь к существующей.</p>
          </div>
        ) : !selectedTeamHasBoards ? (
          <div className="boards-team-empty-hint" role="status" aria-live="polite">
            <p className="boards-team-empty-hint__text">В этой команде пока нет досок. Создайте первую доску, чтобы начать работу вместе.</p>
          </div>
        ) : (
          <>
            <div className="boards-toolbar">
                <div className="boards-filters">
                <div className="filter-group">
                  <span className="filter-label">Фильтр</span>
                  <select
                    className="filter-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as BoardFilter)}
                  >
                    <option value="all">Все доски</option>
                    <option value="starred">Избранное</option>
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Владелец</span>
                  <select
                    className="filter-select"
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}
                  >
                    <option value="anyone">Любой владелец</option>
                    <option value="me">Мои доски</option>
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Сортировка</span>
                  <select
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                  >
                    <option value="last-opened">Последние открытые</option>
                    <option value="name">По названию</option>
                    <option value="updated">По дате изменения</option>
                  </select>
                </div>
              </div>

              <div className="boards-view-toggle"><ViewToggle view={view} setView={setView} /></div>
            </div>

            {boards.length === 0 && filtersActive ? (
              <div className="boards-team-empty-hint" role="status" aria-live="polite">
                <p className="boards-team-empty-hint__text">По выбранным фильтрам нет досок.</p>
              </div>
            ) : view === "grid" ? (
              <div className="boards-grid">
                {boards.map((b, index) => {
                  const isStarred = b.isStarred ?? false;
                  const isMenuOpen = menuBoardId === b.id;
                  const colorKey = b.colorKey ?? COLOR_KEYS[index % COLOR_KEYS.length];
                  return (
                    <div
                      key={b.id}
                      className={`board-card ${isMenuOpen ? "board-card--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                      data-board-id={b.id}
                      ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}
                      onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                      onClick={() => openBoardWindow(b)}
                    >
                      <div className={`board-header board-header--${colorKey}`}>
                        <div className="board-preview" />
                        <div className="board-card-controls" aria-hidden onClick={(e) => e.stopPropagation()}>
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

                          <div className={`board-star-wrapper ${isStarred ? "board-star-wrapper--active" : ""}`} onClick={(e) => e.stopPropagation()}>
                            <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="grid" />
                          </div>
                        </div>
                      </div>

                      <div className="board-info">
                        <div className="board-title">{b.title}</div>
                        <div className="line"><span className="label">Владелец:</span> {b.owner}</div>
                        <div className="line"><span className="label">Открыта:</span> {b.lastOpened}</div>
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
                  const colorKey = b.colorKey ?? COLOR_KEYS[index % COLOR_KEYS.length];
                  return (
                    <div
                      key={b.id}
                      data-board-id={b.id}
                      className={`boards-list-row ${isMenuOpen ? "boards-list-row--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                      onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                    >
                      <div className="boards-name-cell" onClick={() => openBoardWindow(b)}>
                        <div className={`board-image-small board-image-small--${colorKey}`} aria-hidden />
                        <div className="boards-name-text">
                          <div className="board-row-title">{b.title}</div>
                          <div className="board-row-sub">Изменено: {b.owner}, {b.updated}</div>
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
          </>
        )}
        {toastVisible && <div className="boards-toast">{toastMessage}</div>}
      </div>

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

      {isProfileModalOpen && (
        <ProfileModal
          name={user.name}
          email={user.email}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={(newName: string) => {
            const trimmed = newName.trim();
            if (!trimmed) {
              setIsProfileModalOpen(false);
              return;
            }
            // оптимистичное обновление локально
            setUser({ ...user, name: trimmed });
            setIsProfileModalOpen(false);
            void updateName(trimmed)
              .then(() => showToast("Имя обновлено"))
              .catch(() => {
                // откат
                setUser({ ...user });
                showToast("Не удалось сохранить имя");
              });
          }}
        />
      )}
    </div>
  );
}
