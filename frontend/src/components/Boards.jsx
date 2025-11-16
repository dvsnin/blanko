import { useState, useRef, useLayoutEffect, useEffect } from "react";
import "./Boards.css";
import "./Boards.colors.css";
import ProfileMenu from "./ProfileMenu";
import ProfileModal from "./ProfileModal";
import MenuPortal from "./MenuPortal";
import NotificationsPanel from "./NotificationsPanel";
import TemplatesIsland from "./TemplatesIsland";
import NotificationButton from "./NotificationButton";
import ProfileButton from "./ProfileButton";
import ViewToggle from "./ViewToggle";

/*
  Boards.jsx — исправленная версия
  - включает templatesForIsland чтобы избежать ReferenceError
  - детерминированное присвоение colorKey
  - все остальные правки сохранены
*/

const rawBoards = [
    { id: 1, title: "МояПикерДоска", owner: "Дмитрий Васнянин", updated: "14 ноября", lastOpened: "14 ноября", onlineUsers: 3 },
    { id: 2, title: "Маркетинг 2025", owner: "Дмитрий Васнянин", updated: "12 ноября", lastOpened: "12 ноября", onlineUsers: 1 },
    { id: 3, title: "Roadmap SyncBoard", owner: "Дмитрий Васнянин", updated: "10 ноября", lastOpened: "10 ноября", onlineUsers: 0 },
    { id: 4, title: "Учебный проект", owner: "Дмитрий Васнянин", updated: "8 ноября", lastOpened: "8 ноября", onlineUsers: 2 },
    { id: 5, title: "Личное планирование", owner: "Дмитрий Васнянин", updated: "7 ноября", lastOpened: "7 ноября", onlineUsers: 0 },
    { id: 6, title: "Личное", owner: "Дмитрий Васнянин", updated: "12 декабря", lastOpened: "12 декабря", onlineUsers: 0 },
    { id: 7, title: "Финансы", owner: "Дмитрий Васнянин", updated: "13 декабря", lastOpened: "13 декабря", onlineUsers: 0 },
];

const colorKeys = [
    "mintBlue","peach","lilac","aqua","sunset","grass","ocean","berry","grape","night",
    "lava","sky","forest","lemon","rose","steel","sand","teal","freshMint","indigo",
];

/* === helper color logic === */
function pickAvailableColorFrom(boards) {
    const used = new Set(boards.map((b) => b.colorKey).filter(Boolean));
    for (const key of colorKeys) {
        if (!used.has(key)) return key;
    }
    return colorKeys[boards.length % colorKeys.length];
}

function assignColorsToInitial(list) {
    const out = [];
    const used = new Set();
    for (let i = 0; i < list.length; i++) {
        const b = { ...list[i] };
        if (!b.colorKey) {
            const available = colorKeys.find((k) => !used.has(k));
            b.colorKey = available || colorKeys[i % colorKeys.length];
        }
        used.add(b.colorKey);
        out.push(b);
    }
    return out;
}

const initialBoards = assignColorsToInitial(rawBoards);

/* === templatesForIsland — нужен для <TemplatesIsland /> (исправляет ReferenceError) === */
const templatesForIsland = [
    { id: "tpl-blank", title: "Blank Board", subtype: "New", variant: "template-thumb--blank", badge: "New" },
    { id: "tpl-retro", title: "Kanban", subtype: "Template", variant: "thumb-retro" },
    { id: "tpl-year", title: "Sprint Planning", subtype: "Template", variant: "thumb-year" },
    { id: "tpl-brain", title: "Brainstorm", subtype: "Template", variant: "thumb-brain" },
    { id: "tpl-roadmap", title: "Roadmap", subtype: "Template", variant: "thumb-roadmap" },
    { id: "tpl-sprint", title: "Study", subtype: "Template", variant: "thumb-sprint" },
];

export default function Boards() {
    // USER / PROFILE
    const [user, setUser] = useState({ name: "", email: "" });
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && window.dashData) {
            setUser({ name: window.dashData.name || "", email: window.dashData.email || "" });
        }
    }, []);

    const userInitial = user.name ? user.name[0].toUpperCase() : "?";

    // BOARDS STATE
    const [boards, setBoards] = useState(initialBoards);
    const [view, setView] = useState("grid");
    const [menuBoardId, setMenuBoardId] = useState(null);
    const [starredIds, setStarredIds] = useState(() => new Set());

    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimeoutRef = useRef(null);

    // refs for portal positioning & measuring
    const menuRef = useRef(null);
    const menuAnchorRef = useRef(null);
    const menuCardRef = useRef(null);

    // notifications panel ref
    const notificationsRef = useRef(null);

    const [menuPlacement, setMenuPlacement] = useState("bottom");
    const [forceMenuTop, setForceMenuTop] = useState(false);
    const [shiftMenuLeft, setShiftMenuLeft] = useState(false);

    // Notifications panel
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // dialogs
    const [dialog, setDialog] = useState(null);
    const [renameDraft, setRenameDraft] = useState("");

    // Ensure any boards loaded later without colorKey get one
    useEffect(() => {
        setBoards((prev) => {
            let changed = false;
            const used = new Set(prev.map((b) => b.colorKey).filter(Boolean));
            const next = prev.map((b, i) => {
                if (!b.colorKey) {
                    const available = colorKeys.find((k) => !used.has(k));
                    const key = available || colorKeys[i % colorKeys.length];
                    used.add(key);
                    changed = true;
                    return { ...b, colorKey: key };
                }
                return b;
            });
            return changed ? next : prev;
        });
    }, []);

    // Helpers
    const showToast = (message) => {
        setToastMessage(message);
        setToastVisible(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 2000);
    };

    const toggleStarInternal = (id) => {
        setStarredIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleStarClick = (board) => {
        const willStar = !starredIds.has(board.id);
        toggleStarInternal(board.id);
        showToast(willStar ? "Board starred" : "Board unstarred");
    };

    const handleCreateBoard = () => {
        setBoards((prev) => {
            const colorKey = pickAvailableColorFrom(prev);
            const maxId = prev.reduce((m, b) => Math.max(m, b.id), 0);
            const id = maxId + 1;
            const newBoard = { id, title: "Untitled", owner: user.name || "Owner", updated: "только что", lastOpened: "только что", onlineUsers: 0, colorKey };
            return [...prev, newBoard];
        });
        showToast("Board created");
    };

    const openRenameDialog = (board) => {
        setRenameDraft(board.title);
        setDialog({ type: "rename", boardId: board.id });
        setMenuBoardId(null);
        menuCardRef.current = null;
    };

    const openDeleteDialog = (board) => {
        setDialog({ type: "delete", boardId: board.id });
        setMenuBoardId(null);
        menuCardRef.current = null;
    };

    const closeDialog = () => {
        setDialog(null);
        setRenameDraft("");
    };

    const handleRenameConfirm = () => {
        if (!dialog || dialog.type !== "rename") return;
        const value = renameDraft.trim();
        if (!value) {
            closeDialog();
            return;
        }
        setBoards((prev) => prev.map((b) => (b.id === dialog.boardId ? { ...b, title: value } : b)));
        closeDialog();
        showToast("Board renamed");
    };

    const handleDeleteConfirm = () => {
        if (!dialog || dialog.type !== "delete") return;
        const id = dialog.boardId;
        setBoards((prev) => prev.filter((b) => b.id !== id));
        setStarredIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        closeDialog();
        showToast("Board deleted");
    };

    const handleMenuToggle = (id) => {
        setMenuBoardId((prev) => {
            const next = prev === id ? null : id;
            if (next === null) {
                setMenuPlacement("bottom");
                setForceMenuTop(false);
                menuCardRef.current = null;
            }
            return next;
        });
    };

    // compute placement after menu rendered in portal
    useLayoutEffect(() => {
        if (!menuBoardId || !menuRef.current || forceMenuTop) return;
        const margin = 16;
        const updatePlacement = () => {
            if (!menuRef.current) return;
            const rect = menuRef.current.getBoundingClientRect();
            setMenuPlacement(rect.bottom > window.innerHeight - margin ? "top" : "bottom");
        };
        updatePlacement();
        window.addEventListener("resize", updatePlacement);
        window.addEventListener("scroll", updatePlacement, true);
        return () => {
            window.removeEventListener("resize", updatePlacement);
            window.removeEventListener("scroll", updatePlacement, true);
        };
    }, [menuBoardId, view, forceMenuTop]);

    // shift-left detection
    useLayoutEffect(() => {
        if (!menuBoardId || !menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        setShiftMenuLeft(rect.left < 8);
    }, [menuBoardId, view]);

    // click outside and Esc (fallback) - also closes notifications panel
    useEffect(() => {
        function handleClickOutside(e) {
            if (menuBoardId) {
                const menuEl = menuRef.current;
                const anchorEl = menuAnchorRef.current;
                const cardEl = menuCardRef.current;
                if (!(menuEl && menuEl.contains(e.target)) && !(anchorEl && anchorEl.contains(e.target)) && !(cardEl && cardEl.contains(e.target))) {
                    setMenuBoardId(null);
                    menuCardRef.current = null;
                }
            }
            if (isNotificationsOpen) {
                const notifEl = notificationsRef.current;
                if (!(notifEl && notifEl.contains(e.target))) {
                    setIsNotificationsOpen(false);
                }
            }
        }
        function handleKeydown(e) {
            if (e.key === "Escape") {
                setMenuBoardId(null);
                menuCardRef.current = null;
                setIsNotificationsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeydown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeydown);
        };
    }, [menuBoardId, isNotificationsOpen]);

    // pointer tracking (grid strict / list corridor)
    useEffect(() => {
        if (!menuBoardId) return;
        function pointInRect(x, y, rect) {
            return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        }
        function expandRect(rect, pad) {
            if (!rect) return null;
            return { left: rect.left - pad, top: rect.top - pad, right: rect.right + pad, bottom: rect.bottom + pad };
        }
        function unionRects(rects) {
            const valid = rects.filter(Boolean);
            if (valid.length === 0) return null;
            return { left: Math.min(...valid.map((r) => r.left)), top: Math.min(...valid.map((r) => r.top)), right: Math.max(...valid.map((r) => r.right)), bottom: Math.max(...valid.map((r) => r.bottom)) };
        }
        function onMouseMove(e) {
            const x = e.clientX, y = e.clientY;
            const el = document.elementFromPoint(x, y);
            if (el) {
                const cardAncestor = el.closest?.(".board-card, .boards-list-row");
                if (cardAncestor && cardAncestor !== menuCardRef.current) {
                    setMenuBoardId(null);
                    menuCardRef.current = null;
                    return;
                }
            }
            const menuEl = menuRef.current, anchorEl = menuAnchorRef.current, cardEl = menuCardRef.current;
            const menuRect = menuEl?.getBoundingClientRect(), anchorRect = anchorEl?.getBoundingClientRect(), cardRect = cardEl?.getBoundingClientRect();
            if (pointInRect(x, y, menuRect) || pointInRect(x, y, anchorRect) || pointInRect(x, y, cardRect)) return;
            if (view === "grid") {
                setMenuBoardId(null);
                menuCardRef.current = null;
                return;
            }
            const baseUnion = unionRects([menuRect, anchorRect, cardRect]);
            const pad = 40;
            const hull = expandRect(baseUnion, pad);
            if (pointInRect(x, y, hull)) return;
            setMenuBoardId(null);
            menuCardRef.current = null;
        }
        document.addEventListener("mousemove", onMouseMove, { passive: true });
        return () => document.removeEventListener("mousemove", onMouseMove);
    }, [menuBoardId, view]);

    // blur filter-select when clicking outside (capture)
    useEffect(() => {
        function handleDocMouseDown(e) {
            const active = document.activeElement;
            if (!active) return;
            if (active.classList && active.classList.contains("filter-select")) {
                const clickedInsideSelect = e.target.closest && e.target.closest(".filter-select");
                if (!clickedInsideSelect) {
                    try {
                        active.blur();
                        setTimeout(() => {
                            if (document.activeElement === active) {
                                try { active.blur(); } catch (err) {}
                            }
                        }, 0);
                    } catch (err) {}
                }
            }
        }
        document.addEventListener("mousedown", handleDocMouseDown, true);
        return () => document.removeEventListener("mousedown", handleDocMouseDown, true);
    }, []);

    const handleRenameKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleRenameConfirm();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            closeDialog();
        }
    };

    const handleProfileSave = (newName) => {
        setUser((prev) => ({ ...prev, name: newName }));
        if (typeof window !== "undefined" && window.dashData) {
            window.dashData.name = newName;
        }
        setIsProfileModalOpen(false);
    };

    return (
        <div className="boards-page">
            {/* TOP BAR */}
            <header className="topbar">
                <div className="topbar-left"><span className="topbar-logo">Blanko</span></div>
                <div className="topbar-center" aria-hidden />
                <div className="topbar-right">
                    <NotificationButton unreadCount={unreadCount} onClick={() => setIsNotificationsOpen((v) => !v)} />
                    <ProfileButton userInitial={userInitial} onClick={() => setIsProfileMenuOpen((prev) => !prev)} />
                    {isProfileMenuOpen && (
                        <ProfileMenu
                            name={user.name || "User"}
                            email={user.email || "user@example.com"}
                            onSettings={() => { setIsProfileMenuOpen(false); setIsProfileModalOpen(true); }}
                            onLogout={() => console.log("Logout clicked")}
                            onClose={() => setIsProfileMenuOpen(false)}
                        />
                    )}
                </div>
            </header>

            {/* NotificationsPanel */}
            <NotificationsPanel ref={notificationsRef} isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

            <div className="topbar-divider" />

            {/* Templates */}
            <TemplatesIsland templates={templatesForIsland} />

            <div className="templates-bottom-divider" />

            <div className="boards-wrapper">
                <div className="boards-header-line">
                    <button type="button" className="primary-btn create-btn" onClick={handleCreateBoard} aria-label="Create board">+ Create board</button>
                </div>

                <div className="boards-toolbar">
                    <div className="boards-filters">
                        <div className="filter-group"><span className="filter-label">Filter by</span><select className="filter-select" defaultValue="all"><option value="all">All boards</option></select></div>
                        <div className="filter-group"><span className="filter-label">Owned by</span><select className="filter-select" defaultValue="anyone"><option value="anyone">Owned by anyone</option><option value="me">Owned by me</option></select></div>
                        <div className="filter-group"><span className="filter-label">Sort by</span><select className="filter-select" defaultValue="last-opened"><option value="last-opened">Last opened</option><option value="name">Name</option><option value="updated">Last modified</option></select></div>
                    </div>

                    <div className="boards-view-toggle"><ViewToggle view={view} setView={setView} /></div>
                </div>

                {view === "grid" ? (
                    <div className="boards-grid">
                        {boards.map((b, index) => {
                            const isStarred = starredIds.has(b.id);
                            const isMenuOpen = menuBoardId === b.id;
                            const colorKey = b.colorKey ?? colorKeys[index % colorKeys.length];

                            return (
                                <div key={b.id} className={`board-card ${isMenuOpen ? "board-card--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`} ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}>
                                    <div className={`board-header board-header--${colorKey}`}>
                                        <div className="board-preview" />
                                        <div className="board-card-controls" aria-hidden>
                                            <div className="board-menu-wrapper">
                                                <button type="button" className="board-menu-btn" aria-label="Board options" onClick={(e) => { e.stopPropagation(); menuAnchorRef.current = e.currentTarget; setForceMenuTop(false); setMenuPlacement("bottom"); handleMenuToggle(b.id); }}>⋯</button>
                                                {menuBoardId === b.id && (
                                                    <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} shiftLeft={shiftMenuLeft}>
                                                        <div ref={menuRef} className={`board-card-menu ${menuPlacement === "top" ? "board-card-menu--above" : ""} ${shiftMenuLeft ? "shifted-left" : ""}`} onClick={(e) => e.stopPropagation()}>
                                                            <button type="button" className="board-card-menu-item" onClick={() => console.log("Share", b.id)}><span className="board-card-menu-icon">↗︎</span><span className="board-card-menu-label">Поделиться</span></button>
                                                            <button type="button" className="board-card-menu-item" onClick={() => console.log("Copy link", b.id)}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
                                                            <button type="button" className="board-card-menu-item" onClick={() => console.log("Open in new tab", b.id)}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
                                                            <div className="board-card-menu-separator" />
                                                            <button type="button" className="board-card-menu-item" onClick={() => console.log("Info", b.id)}><span className="board-card-menu-icon">ⓘ</span><span className="board-card-menu-label">Инфо</span></button>
                                                            <button type="button" className="board-card-menu-item" onClick={() => openRenameDialog(b)}><span className="board-card-menu-icon">✎</span><span className="board-card-menu-label">Переименовать</span></button>
                                                            <div className="board-card-menu-separator" />
                                                            <button type="button" className="board-card-menu-item board-card-menu-item--danger" onClick={() => openDeleteDialog(b)}><span className="board-card-menu-icon">🗑</span><span className="board-card-menu-label">Удалить</span></button>
                                                        </div>
                                                    </MenuPortal>
                                                )}
                                            </div>
                                            <div className={`board-star-wrapper ${isStarred ? "board-star-wrapper--active" : ""}`}>
                                                <button type="button" className={`board-star-btn ${isStarred ? "board-star-btn--active" : ""}`} aria-label={isStarred ? "Unstar this board" : "Star this board"} onClick={(e) => { e.stopPropagation(); handleStarClick(b); }}>{isStarred ? "★" : "☆"}</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="board-info">
                                        <div className="board-title">{b.title}</div>
                                        <div className="line"><span className="label">Owner:</span> {b.owner}</div>
                                        <div className="line"><span className="label">Last opened:</span> {b.lastOpened}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="boards-list">
                        <div className="boards-list-header"><div>Name</div><div>Online users</div><div>Last opened</div><div>Owner</div><div /></div>
                        {boards.map((b, index) => {
                            const isStarred = starredIds.has(b.id);
                            const isMenuOpen = menuBoardId === b.id;
                            const isLastRow = index === boards.length - 1;
                            const colorKey = b.colorKey ?? colorKeys[index % colorKeys.length];
                            return (
                                <div key={b.id} className={`boards-list-row ${isMenuOpen ? "boards-list-row--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`} ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}>
                                    <div className="boards-name-cell">
                                        <div className={`board-image-small board-image-small--${colorKey}`} />
                                        <div className="boards-name-text">
                                            <div className="board-row-title">{b.title}</div>
                                            <div className="board-row-sub">Modified by {b.owner}, {b.updated}</div>
                                        </div>
                                    </div>
                                    <div className="boards-col">{b.onlineUsers > 0 ? `${b.onlineUsers} online` : "—"}</div>
                                    <div className="boards-col">{b.lastOpened}</div>
                                    <div className="boards-col">{b.owner}</div>
                                    <div className="boards-actions-cell">
                                        <button type="button" className={`boards-row-star-btn ${isStarred ? "boards-row-star-btn--active" : ""}`} aria-label={isStarred ? "Unstar this board" : "Star this board"} onClick={(e) => { e.stopPropagation(); handleStarClick(b); }}>{isStarred ? "★" : "☆"}</button>
                                        <button type="button" className="boards-row-menu-btn" aria-label="Board options" onClick={(e) => { e.stopPropagation(); const forceTop = isLastRow; setForceMenuTop(forceTop); setMenuPlacement(forceTop ? "top" : "bottom"); menuAnchorRef.current = e.currentTarget; handleMenuToggle(b.id); }}>⋯</button>
                                        {menuBoardId === b.id && (
                                            <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} shiftLeft={shiftMenuLeft}>
                                                <div ref={menuRef} className={`board-card-menu board-card-menu--list ${menuPlacement === "top" ? "board-card-menu--above" : ""} ${shiftMenuLeft ? "shifted-left" : ""}`} onClick={(e) => e.stopPropagation()}>
                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Share", b.id)}><span className="board-card-menu-icon">↗︎</span><span className="board-card-menu-label">Поделиться</span></button>
                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Copy link", b.id)}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Open in new tab", b.id)}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
                                                    <div className="board-card-menu-separator" />
                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Info", b.id)}><span className="board-card-menu-icon">ⓘ</span><span className="board-card-menu-label">Инфо</span></button>
                                                    <button type="button" className="board-card-menu-item" onClick={() => openRenameDialog(b)}><span className="board-card-menu-icon">✎</span><span className="board-card-menu-label">Переименовать</span></button>
                                                    <div className="board-card-menu-separator" />
                                                    <button type="button" className="board-card-menu-item board-card-menu-item--danger" onClick={() => openDeleteDialog(b)}><span className="board-card-menu-icon">🗑</span><span className="board-card-menu-label">Удалить</span></button>
                                                </div>
                                            </MenuPortal>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {toastVisible && <div className="boards-toast">{toastMessage}</div>}
            </div>

            {/* PROFILE MODAL */}
            {isProfileModalOpen && <ProfileModal name={user.name} email={user.email} onClose={() => setIsProfileModalOpen(false)} onSave={handleProfileSave} />}
        </div>
    );
}