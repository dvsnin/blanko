import React, { useEffect, useRef, useState } from "react";
import "./TemplatesIsland.css";

/*
  TemplatesIsland (final tweak for first template)
  - First template: "Новый" rendered centered INSIDE the white rectangle (.template-thumb-inner)
  - Other templates: title rendered inside white rectangle as before (no white oval)
  - Item width / gap must match CSS (150 / 22)
*/

const DEFAULT_TEMPLATES = [
    { id: "tpl-blank", title: "Blank board", variant: "template-thumb--blank", badge: "Новый" },
    { id: "tpl-retro", title: "Ретро", variant: "thumb-retro" },
    { id: "tpl-year", title: "Итоги года", variant: "thumb-year" },
    { id: "tpl-brain", title: "Мозговой штурм", variant: "thumb-brain" },
    { id: "tpl-roadmap", title: "Roadmap", variant: "thumb-roadmap" },
    { id: "tpl-sprint", title: "План спринта", variant: "thumb-sprint" },
    { id: "tpl-study", title: "Учебный проект", variant: "thumb-study" },
];

export default function TemplatesIsland({
                                            templates = DEFAULT_TEMPLATES,
                                            itemWidth = 150,
                                            gap = 22,
                                        }) {
    const innerRef = useRef(null);
    const [maxVisible, setMaxVisible] = useState(templates.length);

    useEffect(() => {
        const el = innerRef.current;
        if (!el) return;

        function calculate() {
            const containerWidth = el.clientWidth || el.getBoundingClientRect().width;
            const count = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
            setMaxVisible(Math.min(count, templates.length));
        }

        calculate();

        let ro = null;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(() => calculate());
            ro.observe(el);
        } else {
            window.addEventListener("resize", calculate);
        }

        return () => {
            if (ro) ro.disconnect();
            else window.removeEventListener("resize", calculate);
        };
    }, [templates, itemWidth, gap]);

    const visibleTemplates = templates.slice(0, maxVisible);

    return (
        <section className="templates-island ti-island" aria-label="Templates island">
            <div className="templates-inner ti-inner" ref={innerRef}>
                <ul className="templates-row ti-row" role="list">
                    {visibleTemplates.map((t, idx) => {
                        const variant = t.variant || "";
                        const legacyVariant =
                            variant.startsWith("template-thumb--") ? variant : `template-thumb--${variant}`.replace(/template-thumb--thumb-/, "template-thumb--");
                        const tiVariant = variant.startsWith("thumb-") ? variant : variant.replace(/^template-thumb--/, "thumb-");
                        const thumbClass = ["template-thumb", "ti-thumb", legacyVariant, tiVariant].filter(Boolean).join(" ");

                        // first item is special: show "Новый" inside the white rectangle (no oval)
                        const isFirst = idx === 0;

                        return (
                            <li key={t.id} className="template-item ti-item" role="listitem" aria-hidden={false}>
                                <button
                                    type="button"
                                    className="template-thumb-button ti-thumb-button"
                                    aria-label={`Открыть шаблон: ${t.title}`}
                                    onClick={() => {
                                        console.log("Template click:", t.id);
                                    }}
                                >
                                    <div className={thumbClass}>
                                        <div className="template-thumb-inner ti-thumb-inner" aria-hidden>
                                            {isFirst ? (
                                                // centered label inside white rectangle for the first template
                                                <div className="ti-thumb-new-inner" aria-hidden>
                                                    {t.badge || "Новый"}
                                                </div>
                                            ) : (
                                                // other templates: title inside the white rectangle (max 2 lines)
                                                <div className="ti-thumb-caption-inner" aria-hidden>
                                                    {t.title}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}