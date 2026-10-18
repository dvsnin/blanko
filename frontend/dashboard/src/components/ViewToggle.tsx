import "./ViewToggle.css";

export type BoardsView = "grid" | "list";

export interface ViewToggleProps {
    view: BoardsView;
    setView: (view: BoardsView) => void;
}

export default function ViewToggle({ view, setView }: ViewToggleProps) {
    return (
        <div className="view-toggle" role="toolbar" aria-label="Переключить вид">
            <button
                type="button"
                className={`vt-btn vt-btn--grid ${view === "grid" ? "vt-active" : ""}`}
                aria-pressed={view === "grid"}
                title="Плитка"
                onClick={() => setView("grid")}
            >
                <svg className="vt-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
                </svg>
            </button>

            <button
                type="button"
                className={`vt-btn vt-btn--list ${view === "list" ? "vt-active" : ""}`}
                aria-pressed={view === "list"}
                title="Список"
                onClick={() => setView("list")}
            >
                <svg className="vt-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="4" y="5" width="16" height="3" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="4" y="10.5" width="16" height="3" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="4" y="16" width="16" height="3" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
            </button>
        </div>
    );
}
