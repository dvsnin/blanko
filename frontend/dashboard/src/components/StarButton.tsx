import "./StarButton.css";

export default function StarButton({ isStarred = false, onToggle, size = 36, variant = "grid", ariaLabel }) {
    const wrapperClass = `star-wrap ${variant === "list" ? "star-wrap--list" : "star-wrap--grid"} ${isStarred ? "is-starred" : "is-not-starred"}`;

    const handleKey = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (typeof onToggle === "function") onToggle(e);
        }
    };

    return (
        <span
            className={wrapperClass}
            style={{ width: size, height: size }}
        >
      {/* plain glyph visible by default */}
            <span className="star-glyph" aria-hidden>
        {isStarred ? "★" : "☆"}
      </span>

            {/* overlay interactive element that appears on hover / focus-within */}
            <button
                type="button"
                className="star-action"
                aria-label={ariaLabel || (isStarred ? "Убрать звезду" : "Поставить звезду")}
                onClick={(e) => { e.stopPropagation(); if (typeof onToggle === "function") onToggle(e); }}
                onKeyDown={handleKey}
                onMouseDown={(e) => e.preventDefault()} /* prevent focus flick */
            >
        <span className="star-glyph" aria-hidden>{isStarred ? "★" : "☆"}</span>
      </button>
    </span>
    );
}