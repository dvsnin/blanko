import "./NotificationButton.css";

export default function NotificationButton({ unreadCount = 0, onClick, ariaLabel = "Notifications" }) {
    return (
        <button
            type="button"
            className="notification-btn topbar-icon-btn"
            aria-label={ariaLabel}
            onClick={onClick}
        >
            <svg className="bell-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>

            {unreadCount > 0 && (
                <span className="notification-badge" aria-hidden>
                    {unreadCount > 9 ? "9+" : unreadCount}
                </span>
            )}
        </button>
    );
}