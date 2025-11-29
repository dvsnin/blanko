import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import "./Boards.css";
import "./Boards.colors.css";
import "./BoardMenu.css";
import "./Boards.modals.css";
import "./Boards.list.css";
import "./StarButton.css";
import StarButton from "./StarButton";
import MenuButton from "./MenuButton";
import ProfileMenu from "./ProfileMenu";
import ProfileModal from "./ProfileModal";
import MenuPortal from "./MenuPortal";
import NotificationsPanel from "./NotificationsPanel";
import TemplatesIsland from "./TemplatesIsland";
import NotificationButton from "./NotificationButton";
import ProfileButton from "./ProfileButton";
import ViewToggle from "./ViewToggle";

/*
  Boards.jsx — application boards page
  - manages topbar/profile state, notifications, boards list and menus
  - when the app is team-enabled (teamsProp provided):
      * if user has NO teams -> show global hint (already implemented)
      * if user has teams but selected team has NO boards -> hide filters + list
        and show a calm centered hint encouraging to create the first board
  - "Create board" remains visible. It's enabled only when there is an active team.
*/

const colorKeys = [
    "mintBlue","peach","lilac","aqua","sunset","grass","ocean","berry","grape","night",
    "lava","sky","forest","lemon","rose","steel","sand","teal","freshMint","indigo",
];

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

const rawBoards = [
    { id: 1, title: "МояПикерДоска", owner: "Дмитрий Васнянин", updated: "14 ноября", lastOpened: "14 ноября", onlineUsers: 3 },
    { id: 2, title: "Маркетинг 2025", owner: "Дмитрий Васнянин", updated: "12 ноября", lastOpened: "12 ноября", onlineUsers: 1 },
    { id: 3, title: "Roadmap SyncBoard", owner: "Дмитрий Васнянин", updated: "10 ноября", lastOpened: "10 ноября", onlineUsers: 0 },
    { id: 4, title: "Учебный проект", owner: "Дмитрий Васнянин", updated: "8 ноября", lastOpened: "8 ноября", onlineUsers: 2 },
    { id: 5, title: "Личное планирование", owner: "Дмитрий Васнянин", updated: "7 ноября", lastOpened: "7 ноября", onlineUsers: 0 },
    { id: 6, title: "Личное", owner: "Дмитрий Васнянин", updated: "12 декабря", lastOpened: "12 декабря", onlineUsers: 0 },
    { id: 7, title: "Финансы", owner: "Дмитрий Васнянин", updated: "13 декабря", lastOpened: "13 декабря", onlineUsers: 0 },
];

const initialBoards = assignColorsToInitial(rawBoards);

export default function Boards({
                                   teams: teamsProp,
                                   activeTeamId,
                                   setActiveTeamId,
                                   createBoard: createBoardFromApp,
                                   moveBoard: moveBoardFromApp,
                                   renameBoard: renameBoardFromApp,
                                   deleteBoard: deleteBoardFromApp,
                               }) {
    // PROFILE + topbar state
    const [user, setUser] = useState({ name: "", email: "" });
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && window.dashData) {
            setUser({ name: window.dashData.name || "", email: window.dashData.email || "" });
        }
    }, []);

    const userInitial = user.name ? user.name[0].toUpperCase() : "?";

    // BOARDS state
    const [localBoards, setLocalBoards] = useState(initialBoards);
    const boardsSource = teamsProp ? [] : localBoards;

    const [view, setView] = useState("grid");
    const [menuBoardId, setMenuBoardId] = useState(null);
    const [starredIds, setStarredIds] = useState(() => new Set());

    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimeoutRef = useRef(null);

    // portal/menu refs
    const menuRef = useRef(null);
    const menuAnchorRef = useRef(null);
    const menuCardRef = useRef(null);
    const menuStyleRef = useRef(null);

    const [menuStyle, setMenuStyle] = useState(null);
    const [menuPlacement, setMenuPlacement] = useState("left");
    const [shiftMenuLeft, setShiftMenuLeft] = useState(false);

    // Notifications
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationsRef = useRef(null);
    const notificationsAnchorRef = useRef(null);

    // Dialogs
    const [dialog, setDialog] = useState(null);
    const [renameDraft, setRenameDraft] = useState("");

    // Helpers
    const showToast = (message) => {
        setToastMessage(message);
        setToastVisible(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 1800);
    };

    const handleStarClick = (board) => {
        setStarredIds((prev) => {
            const next = new Set(prev);
            const willStar = !next.has(board.id);
            if (willStar) next.add(board.id); else next.delete(board.id);
            showToast(willStar ? "Board starred" : "Board unstarred");
            return next;
        });
    };

    // create board
    const handleCreateBoard = () => {
        if (createBoardFromApp) {
            const title = prompt("Название доски") || "Новая доска";
            createBoardFromApp(title);
            showToast("Доска создана");
            return;
        }
        setLocalBoards((prev) => {
            const colorKey = pickAvailableColorFrom(prev);
            const maxId = prev.reduce((m, b) => Math.max(m, b.id), 0);
            const id = maxId + 1;
            const newBoard = { id, title: "Новая доска", owner: user.name || "Owner", updated: "только что", lastOpened: "только что", onlineUsers: 0, colorKey };
            return [...prev, newBoard];
        });
        showToast("Доска создана");
    };

    // rename/delete dialogs
    const openRenameDialog = (board) => {
        setRenameDraft(board.title);
        setDialog({ type: "rename", boardId: board.id });
        closeMenu();
    };

    const openDeleteDialog = (board) => {
        setDialog({ type: "delete", boardId: board.id });
        closeMenu();
    };

    const closeDialog = () => { setDialog(null); setRenameDraft(""); };

    const handleRenameConfirm = () => {
        if (!dialog || dialog.type !== "rename") return;
        const value = renameDraft.trim();
        if (!value) { closeDialog(); return; }

        if (teamsProp) {
            if (typeof renameBoardFromApp === "function") {
                renameBoardFromApp(dialog.boardId, value);
                showToast("Доска переименована");
            } else {
                console.log("Rename requested for board id:", dialog.boardId, "new name:", value);
                showToast("Доска переименована (request logged)");
            }
        } else {
            setLocalBoards((prev) => prev.map((b) => (b.id === dialog.boardId ? { ...b, title: value } : b)));
            showToast("Доска переименована");
        }
        closeDialog();
    };

    const handleDeleteConfirm = () => {
        if (!dialog || dialog.type !== "delete") return;
        const id = dialog.boardId;

        if (teamsProp) {
            if (typeof deleteBoardFromApp === "function") {
                deleteBoardFromApp(id);
                showToast("Доска удалена");
            } else {
                console.log("Delete requested for board id:", id);
                showToast("Доска удалена (request logged)");
            }
        } else {
            setLocalBoards((prev) => prev.filter((b) => b.id !== id));
            setStarredIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            showToast("Доска удалена");
        }

        try {
            if (menuAnchorRef.current && Number(menuAnchorRef.current.dataset.boardId) === id) {
                menuAnchorRef.current = null;
            }
        } catch (err) {}
        closeMenu();
        closeDialog();
    };

    // centralize menu close logic so all codepaths behave same
    function closeMenu() {
        setMenuBoardId(null);
        menuCardRef.current = null;
        setMenuStyle(null);
        try {
            // ensure anchor blur so the overlay/focus state is removed visually
            if (menuAnchorRef.current && typeof menuAnchorRef.current.blur === "function") {
                try { menuAnchorRef.current.blur(); } catch {}
            }
        } catch (err) {}
        menuAnchorRef.current = null;
    }

    // menu toggle logic
    const handleMenuToggle = (id) => {
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

    // compute menu placement & style
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

            const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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

    // click outside & escape handling
    useEffect(() => {
        function isEventInside(event, element) {
            if (!event || !element) return false;
            if (event.composedPath) {
                const path = event.composedPath();
                return path.indexOf(element) !== -1;
            }
            if (event.path && event.path.length) {
                return event.path.indexOf(element) !== -1;
            }
            return element.contains ? element.contains(event.target) : false;
        }

        function handleClickOutside(e) {
            if (menuBoardId) {
                const menuEl = menuRef.current;
                const anchorEl = menuAnchorRef.current;
                const insideMenu = isEventInside(e, menuEl);
                const onAnchor = isEventInside(e, anchorEl);
                if (!insideMenu && !onAnchor) {
                    closeMenu();
                }
            }
            if (isNotificationsOpen) {
                const notifEl = notificationsRef.current;
                const notifAnchorEl = notificationsAnchorRef.current;
                const insideNotif = isEventInside(e, notifEl);
                const onNotifAnchor = isEventInside(e, notifAnchorEl);
                if (!insideNotif && !onNotifAnchor) {
                    setIsNotificationsOpen(false);
                }
            }
        }

        function handleKeydown(e) {
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

    // board list/array to render — chosen by activeTeamId if teamsProp given
    const renderContext = useMemo(() => {
        if (teamsProp) {
            // When teamsProp is provided, show boards only for a selected team.
            // If no activeTeamId is set (user has no teams), do not fall back to localBoards.
            const team = activeTeamId ? teamsProp.find((t) => t.id === activeTeamId) : null;
            return { team: team || null, boards: team ? assignColorsToInitial(team.boards || []) : [] };
        }
        // legacy fallback when app is not team-enabled: use localBoards
        return { team: null, boards: assignColorsToInitial(localBoards) };
    }, [teamsProp, activeTeamId, localBoards]);

    // Determine whether user is allowed to create boards:
    // - If app is team-enabled (teamsProp provided), user can create only when an activeTeamId is set.
    // - If app is not team-enabled (teamsProp absent), allow creating local boards.
    const canCreateBoard = teamsProp ? Boolean(activeTeamId) : true;

    // Determine whether the user actually has teams (used to show global placeholder)
    const userHasTeams = Array.isArray(teamsProp) ? teamsProp.length > 0 : true;

    // Determine whether the selected team (if any) has boards
    const selectedTeamHasBoards = Boolean(renderContext.team && (renderContext.boards || []).length > 0);

    // UI render
    return (
        <div className="boards-page">
            {/* TOP BAR */}
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
                            name={user.name || "User"}
                            email={user.email || "user@example.com"}
                            onSettings={() => {
                                setIsProfileMenuOpen(false);
                                setIsProfileModalOpen(true);
                            }}
                            onLogout={() => console.log("Logout clicked")}
                            onClose={() => setIsProfileMenuOpen(false)}
                        />
                    )}
                </div>
            </header>

            <NotificationsPanel ref={notificationsRef} isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

            <div className="topbar-divider" />

            {/* TEMPLATE ISLAND */}
            <TemplatesIsland />

            <div className="templates-bottom-divider" />

            <div className="boards-wrapper">
                <div className="boards-header-line">
                    <button
                        type="button"
                        className={`primary-btn create-btn ${!canCreateBoard ? "disabled" : ""}`}
                        onClick={() => {
                            if (!canCreateBoard) return;
                            (createBoardFromApp ? createBoardFromApp() : handleCreateBoard());
                        }}
                        disabled={!canCreateBoard}
                        aria-disabled={!canCreateBoard}
                        title={!canCreateBoard ? "Нельзя создавать доски без выбранной команды" : "Создать доску"}
                    >
                        + Создать доску
                    </button>
                </div>

                {/* If user has no teams (team-enabled app), show minimal centered hint instead of filters + boards */}
                {!userHasTeams ? (
                    <div className="boards-empty-hint" role="status" aria-live="polite">
                        <p className="boards-empty-hint__text">Чтобы создавать доски, создайте команду или присоединитесь к существующей.</p>
                    </div>
                ) : (
                    // If the user has teams but selected team has no boards -> show team-empty hint
                    !selectedTeamHasBoards ? (
                        <div className="boards-team-empty-hint" role="status" aria-live="polite">
                            <p className="boards-team-empty-hint__text">В этой команде пока нет досок. Создайте первую доску, чтобы начать работу вместе.</p>
                        </div>
                    ) : (
                        <>
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
                                    {renderContext.boards.map((b, index) => {
                                        const isStarred = starredIds.has(b.id);
                                        const isMenuOpen = menuBoardId === b.id;
                                        const colorKey = b.colorKey ?? colorKeys[index % colorKeys.length];
                                        return (
                                            <div
                                                key={b.id}
                                                className={`board-card ${isMenuOpen ? "board-card--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                                                data-board-id={b.id}
                                                ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}
                                                onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }} // close menu as cursor leaves card
                                            >
                                                <div className={`board-header board-header--${colorKey}`}>
                                                    <div className="board-preview" />
                                                    <div className="board-card-controls" aria-hidden>
                                                        <div className="board-menu-wrapper">
                                                            <MenuButton
                                                                variant="grid"
                                                                onClick={(e) => {
                                                                    try { e.currentTarget.dataset.boardId = String(b.id); } catch (err) {}
                                                                    menuAnchorRef.current = e.currentTarget;
                                                                    setMenuPlacement("left");
                                                                    setShiftMenuLeft(false);
                                                                    handleMenuToggle(b.id);
                                                                }}
                                                            />
                                                            {menuBoardId === b.id && (
                                                                <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} shiftLeft={shiftMenuLeft} onClose={closeMenu}>
                                                                    <div ref={menuRef} className="board-card-menu" style={menuStyle || {}} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => { console.log("Share", b.id); }}><span className="board-card-menu-icon">↗︎</span><span className="board-card-menu-label">Поделиться</span></button>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => { console.log("Copy link", b.id); }}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => { console.log("Open in new tab", b.id); }}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
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
                                                            <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="grid" />
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
                                    <div className="boards-list-header" role="row">
                                        <div>Name</div>
                                        <div style={{ textAlign: "center" }}>Online users</div>
                                        <div style={{ textAlign: "center" }}>Last opened</div>
                                        <div style={{ textAlign: "left" }}>Owner</div>
                                        <div style={{ textAlign: "right" }} aria-hidden> </div>
                                    </div>

                                    {renderContext.boards.map((b, index) => {
                                        const isStarred = starredIds.has(b.id);
                                        const isMenuOpen = menuBoardId === b.id;
                                        const isLastRow = index === renderContext.boards.length - 1;
                                        const colorKey = b.colorKey ?? colorKeys[index % colorKeys.length];
                                        return (
                                            <div
                                                key={b.id}
                                                data-board-id={b.id}
                                                className={`boards-list-row ${isMenuOpen ? "boards-list-row--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                                                onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                                            >
                                                <div className="boards-name-cell">
                                                    <div className={`board-image-small board-image-small--${colorKey}`} aria-hidden />
                                                    <div className="boards-name-text">
                                                        <div className="board-row-title">{b.title}</div>
                                                        <div className="board-row-sub">Modified by {b.owner}, {b.updated}</div>
                                                    </div>
                                                </div>

                                                <div className="boards-col" style={{ textAlign: "center" }}>{b.onlineUsers > 0 ? `${b.onlineUsers} online` : "—"}</div>

                                                <div className="boards-col" style={{ textAlign: "center" }}>{b.lastOpened}</div>

                                                <div className="boards-col owner" style={{ textAlign: "left" }}>{b.owner}</div>

                                                <div className="boards-actions-cell">
                                                    <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="list" />

                                                    <div style={{ position: "relative" }} className="board-menu-wrapper">
                                                        <MenuButton
                                                            variant="list"
                                                            onClick={(e) => {
                                                                try { e.currentTarget.dataset.boardId = String(b.id); } catch (err) {}
                                                                menuAnchorRef.current = e.currentTarget;
                                                                const forceTop = isLastRow;
                                                                setMenuPlacement(forceTop ? "top" : "left");
                                                                handleMenuToggle(b.id);
                                                            }}
                                                        />

                                                        {menuBoardId === b.id && (
                                                            <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} shiftLeft={shiftMenuLeft} onClose={closeMenu}>
                                                                <div ref={menuRef} className="board-card-menu board-card-menu--list" style={menuStyle || {}} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
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
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )
                )}
                {toastVisible && <div className="boards-toast">{toastMessage}</div>}
            </div>

            {/* Rename/Delete modals */}
            {dialog && dialog.type === "rename" && (
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

            {dialog && dialog.type === "delete" && (
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
                            <p>Это приведет к удалению <strong>{(teamsProp ? renderContext.boards : localBoards).find((x) => x.id === dialog.boardId)?.title}</strong>.</p>
                        </div>
                        <div className="boards-modal-footer">
                            <button type="button" className="danger-btn" onClick={handleDeleteConfirm}>Удалить</button>
                            <button type="button" className="secondary-btn" onClick={closeDialog}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile modal */}
            {isProfileModalOpen && (
                <ProfileModal
                    name={user.name}
                    email={user.email}
                    teams={teamsProp || []}
                    activeTeamId={activeTeamId}
                    onOpenTeam={(teamId) => {
                        if (typeof setActiveTeamId === "function") setActiveTeamId(teamId);
                        setIsProfileModalOpen(false);
                    }}
                    onClose={() => setIsProfileModalOpen(false)}
                    onSave={(newName) => {
                        setUser((p) => ({ ...p, name: newName }));
                        setIsProfileModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}