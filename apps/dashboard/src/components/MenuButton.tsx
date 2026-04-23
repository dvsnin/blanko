import React from "react";
import "./MenuButton.css";

/*
  MenuButton (three dots)
  - Visible SVG glyph always present.
  - Overlay rounded-square button appears only when the wrapper is hovered or has keyboard focus.
  - Forwards ref to the overlay button so parent can use it as anchorRef for portals.
  - onMouseDown only stops propagation (NOT preventDefault) so clicks inside portal/menu work.
*/
const MenuButton = React.forwardRef(function MenuButton(
    { onClick, ariaLabel = "Действия с доской", size = 36, variant = "grid" },
    ref
) {
    const wrapClass = `menu-wrap ${variant === "list" ? "menu-wrap--list" : "menu-wrap--grid"}`;

    const handleMouseDown = (e) => {
        // stop propagation so document click handler doesn't immediately close the menu
        e.stopPropagation();
        // DO NOT preventDefault here — allow normal focus/click behaviour so menu items work
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (typeof onClick === "function") onClick(e);
    };

    return (
        <span className={wrapClass} style={{ width: size, height: size }}>
      {/* visible minimal SVG icon (always present) */}
            <svg
                className="menu-icon"
                width="18"
                height="6"
                viewBox="0 0 18 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
                focusable="false"
            >
        <circle cx="3" cy="3" r="2" fill="currentColor" />
        <circle cx="9" cy="3" r="2" fill="currentColor" />
        <circle cx="15" cy="3" r="2" fill="currentColor" />
      </svg>

            {/* overlay interactive button that appears on hover / focus-within */}
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

export default MenuButton;