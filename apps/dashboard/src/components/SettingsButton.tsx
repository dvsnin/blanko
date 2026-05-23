import React from "react";
import "./MenuButton.css";

/*
  SettingsButton (gear icon)
  - Same hover/overlay pattern as MenuButton (uses .menu-wrap / .menu-action).
  - Renders a gear instead of three dots.
  - Forwards ref to the overlay button for portals/anchors.
*/
const SettingsButton = React.forwardRef(function SettingsButton(
    { onClick, ariaLabel = "Настройки команды", size = 36, variant = "grid" },
    ref
) {
    const wrapClass = `menu-wrap ${variant === "list" ? "menu-wrap--list" : "menu-wrap--grid"}`;

    const handleMouseDown = (e) => {
        e.stopPropagation();
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (typeof onClick === "function") onClick(e);
    };

    const iconStyle = {
        position: "relative" as const,
        zIndex: 1,
        pointerEvents: "none" as const,
        color: "inherit",
    };

    return (
        <span className={wrapClass} style={{ width: size, height: size }}>
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={iconStyle}
                aria-hidden
                focusable="false"
            >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <button
                ref={ref}
                type="button"
                className="menu-action"
                aria-label={ariaLabel}
                onMouseDown={handleMouseDown}
                onClick={handleClick}
            />
        </span>
    );
});

export default SettingsButton;
