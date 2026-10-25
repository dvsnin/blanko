import "./ProfileMenu.css";

interface ProfileButtonProps {
    initials: string;
    onClick: () => void;
    ariaLabel?: string;
}

export default function ProfileButton({ initials, onClick, ariaLabel = "Профиль" }: ProfileButtonProps) {
    return (
        <button
            type="button"
            className="profile-avatar-btn topbar-avatar"
            aria-label={ariaLabel}
            onMouseDown={(e) => {
                // Иначе mousedown закрыл бы меню по клику вне, а onClick тут же открыл заново.
                e.stopPropagation();
            }}
            onClick={onClick}
        >
            <span className="profile-avatar-initials" aria-hidden>{initials}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
            </svg>
        </button>
    );
}