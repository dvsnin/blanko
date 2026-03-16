import React, { forwardRef, useEffect, useRef, useState } from "react";
import "./NotificationsPanel.css";

/*
  NotificationsPanel (minimal, updated)
  - Temporarily shows only header, filter control and EMPTY state
  - Removed list items, per-item popup and helper paragraph
  - Empty icon is visually centered
*/

const NotificationsPanel = forwardRef(function NotificationsPanel({ isOpen, onClose }, ref) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [filter, setFilter] = useState("unread"); // "unread" | "all"
    const filterButtonRef = useRef(null);
    const filterMenuRef = useRef(null);

    // close filter when panel closes
    useEffect(() => {
        if (!isOpen) setFilterOpen(false);
    }, [isOpen]);

    // filter menu outside click handling
    useEffect(() => {
        if (!filterOpen) return;
        function onDocDown(e) {
            if (filterMenuRef.current && filterMenuRef.current.contains(e.target)) return;
            if (filterButtonRef.current && filterButtonRef.current.contains(e.target)) return;
            setFilterOpen(false);
        }
        function onEsc(e) {
            if (e.key === "Escape") setFilterOpen(false);
        }
        document.addEventListener("mousedown", onDocDown);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDocDown);
            document.removeEventListener("keydown", onEsc);
        };
    }, [filterOpen]);

    if (!isOpen) return null;

    return (
        <>
            <div className="notifications-backdrop" onClick={onClose} />
            <aside
                ref={ref}
                className="notifications-panel"
                role="dialog"
                aria-label="Уведомления"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="notifications-header">
                    <h2 className="notifications-title">Уведомления</h2>

                    <button
                        className="notifications-close-btn"
                        aria-label="Закрыть"
                        onClick={onClose}
                        title="Закрыть"
                    >
                        ×
                    </button>
                </div>

                <div className="notifications-row">
                    <div className="notifications-filter">
                        <button
                            ref={filterButtonRef}
                            className="notifications-filter-button"
                            aria-haspopup="true"
                            aria-expanded={filterOpen}
                            onClick={() => setFilterOpen((s) => !s)}
                        >
                            <span className="notifications-filter-label">
                                {filter === "unread" ? "Непрочитанные" : "Все"}
                            </span>
                            <span className="notifications-filter-caret">▾</span>
                        </button>

                        {filterOpen && (
                            <div ref={filterMenuRef} className="notifications-filter-menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={filter === "unread"}
                                    className={`notifications-filter-item ${filter === "unread" ? "selected" : ""}`}
                                    onClick={() => {
                                        setFilter("unread");
                                        setFilterOpen(false);
                                    }}
                                >
                                    <span className="notifications-filter-item-label">Непрочитанные</span>
                                    <span className="notifications-filter-radio" aria-hidden>
                                        <span className="notifications-filter-radio-inner" />
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={filter === "all"}
                                    className={`notifications-filter-item ${filter === "all" ? "selected" : ""}`}
                                    onClick={() => {
                                        setFilter("all");
                                        setFilterOpen(false);
                                    }}
                                >
                                    <span className="notifications-filter-item-label">Все</span>
                                    <span className="notifications-filter-radio" aria-hidden>
                                        <span className="notifications-filter-radio-inner" />
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="notifications-list" role="list">
                    <div className="notifications-empty notifications-empty--centered">
                        <svg
                            width="64"
                            height="64"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="notifications-empty-icon"
                            aria-hidden
                        >
                            <path
                                d="M20 21H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4l2-2h4l2 2h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1z"
                                stroke="#9AA0A6"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        <h3 className="notifications-empty-title">У вас пока нет уведомлений</h3>
                    </div>
                </div>
            </aside>
        </>
    );
});

export default NotificationsPanel;