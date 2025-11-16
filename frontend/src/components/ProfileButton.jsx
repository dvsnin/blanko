import React from "react";
import "./ProfileMenu.css";

/*
  ProfileButton (presentational)
  - onMouseDown: stopPropagation to avoid document mousedown handlers closing the menu
  - onClick: toggles menu (handled by parent)
*/
export default function ProfileButton({ userInitial = "U", onClick, ariaLabel = "Profile" }) {
    return (
        <button
            type="button"
            className="profile-avatar-btn topbar-avatar"
            aria-label={ariaLabel}
            onMouseDown={(e) => {
                // Prevent document-level mousedown handlers (e.g. ProfileMenu click-outside)
                // from running before the button's click handler. That avoids the case where
                // mousedown closes the menu and onClick toggles it back open.
                e.stopPropagation();
            }}
            onClick={onClick}
        >
            <span className="profile-avatar-initials" aria-hidden>{userInitial}</span>
        </button>
    );
}