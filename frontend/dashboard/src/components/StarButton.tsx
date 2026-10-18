import type { KeyboardEvent, MouseEvent } from "react";
import "./StarButton.css";

/* Звезда: глиф всегда виден, кнопка-подложка появляется при наведении. */

export interface StarButtonProps {
    isStarred?: boolean;
    onToggle?: (e: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) => void;
    size?: number;
    variant?: "grid" | "list";
    ariaLabel?: string;
}

export default function StarButton({ isStarred = false, onToggle, size = 36, variant = "grid", ariaLabel }: StarButtonProps) {
    const wrapperClass = `star-wrap ${variant === "list" ? "star-wrap--list" : "star-wrap--grid"} ${isStarred ? "is-starred" : "is-not-starred"}`;

    const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle?.(e);
        }
    };

    return (
        <span className={wrapperClass} style={{ width: size, height: size }}>
            <span className="star-glyph" aria-hidden>{isStarred ? "★" : "☆"}</span>
            <button
                type="button"
                className="star-action"
                aria-label={ariaLabel || (isStarred ? "Убрать звезду" : "Поставить звезду")}
                onClick={(e) => { e.stopPropagation(); onToggle?.(e); }}
                onKeyDown={handleKey}
                onMouseDown={(e) => e.preventDefault()}
            >
                <span className="star-glyph" aria-hidden>{isStarred ? "★" : "☆"}</span>
            </button>
        </span>
    );
}
