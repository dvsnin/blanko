import React from "react";
import "./MenuButton.css";

/* Три точки: глиф всегда виден, кнопка-подложка появляется при наведении. Ref - на кнопку. */
export interface MenuButtonProps {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    ariaLabel?: string;
    size?: number;
    variant?: "grid" | "list";
    ariaExpanded?: boolean;
    ariaHasPopup?: "menu" | "true";
}

const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton(
    { onClick, ariaLabel = "Действия с доской", size = 36, variant = "grid", ariaExpanded, ariaHasPopup },
    ref
) {
    const wrapClass = `menu-wrap ${variant === "list" ? "menu-wrap--list" : "menu-wrap--grid"}`;

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Без preventDefault, иначе не работает фокус и клики в меню
        e.stopPropagation();
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (typeof onClick === "function") onClick(e);
    };

    return (
        <span className={wrapClass} style={{ width: size, height: size }}>
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

            <button
                ref={ref}
                type="button"
                className="menu-action"
                aria-label={ariaLabel}
                aria-expanded={ariaExpanded}
                aria-haspopup={ariaHasPopup}
                onMouseDown={handleMouseDown}
                onClick={handleClick}
            />
    </span>
    );
});

export default MenuButton;