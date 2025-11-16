import React from "react";
import "./TemplateThumb.css";

/**
 * TemplateThumb - Individual template thumbnail component
 * @param {Object} template - Template data ({ id, title, variant, badge })
 * @param {number} index - Index in the list (first item has special styling)
 * @param {Function} onClick - Click handler
 */
export default function TemplateThumb({ template, index, onClick }) {
    const { id, title, variant = "", badge } = template;
    
    const isFirst = index === 0;
    
    // Handle variant class names (legacy and new format compatibility)
    const legacyVariant =
        variant.startsWith("template-thumb--") 
            ? variant 
            : `template-thumb--${variant}`.replace(/template-thumb--thumb-/, "template-thumb--");
    const tiVariant = variant.startsWith("thumb-") 
        ? variant 
        : variant.replace(/^template-thumb--/, "thumb-");
    const thumbClass = ["template-thumb", "ti-thumb", legacyVariant, tiVariant].filter(Boolean).join(" ");

    return (
        <li className="template-item ti-item" role="listitem" aria-hidden={false}>
            <button
                type="button"
                className="template-thumb-button ti-thumb-button"
                aria-label={`Открыть шаблон: ${title}`}
                onClick={() => onClick && onClick(id)}
            >
                <div className={thumbClass}>
                    <div className="template-thumb-inner ti-thumb-inner" aria-hidden>
                        {isFirst ? (
                            // centered label inside white rectangle for the first template
                            <div className="ti-thumb-new-inner" aria-hidden>
                                {badge || "Новый"}
                            </div>
                        ) : (
                            // other templates: title inside the white rectangle (max 2 lines)
                            <div className="ti-thumb-caption-inner" aria-hidden>
                                {title}
                            </div>
                        )}
                    </div>
                </div>
            </button>
        </li>
    );
}
