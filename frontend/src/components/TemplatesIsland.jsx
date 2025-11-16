import React, { useEffect, useRef, useState } from "react";
import "./TemplatesIsland.css";

/*
  TemplatesIsland — обновлённая:
  - горизонтальная прокрутка внутри острова
  - названия отображаются только внутри превью (не повторяются под карточкой)
  - добавлен заголовок слева и "View all templates →" справа
  - props:
      templates, itemWidth, gap, viewAllHref (optional), onViewAll (optional)
*/

const DEFAULT_TEMPLATES = [
    { id: "tpl-blank", title: "Blank Board", subtype: "New", variant: "template-thumb--blank", badge: "New" },
    { id: "tpl-retro", title: "Kanban", subtype: "Template", variant: "thumb-retro" },
    { id: "tpl-year", title: "Sprint Planning", subtype: "Template", variant: "thumb-year" },
    { id: "tpl-brain", title: "Brainstorm", subtype: "Template", variant: "thumb-brain" },
    { id: "tpl-roadmap", title: "Roadmap", subtype: "Template", variant: "thumb-roadmap" },
    { id: "tpl-sprint", title: "Study", subtype: "Template", variant: "thumb-sprint" },
    { id: "tpl-study", title: "Study 2", subtype: "Template", variant: "thumb-study" },
];

export default function TemplatesIsland({
                                            templates = DEFAULT_TEMPLATES,
                                            itemWidth = 180,
                                            gap = 22,
                                            viewAllHref = "#/templates",
                                            onViewAll = null,
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

    // show all templates but only render visible count in the tight layout calculation above
    const visibleTemplates = templates.slice(0, templates.length); // we allow scrolling so render all

    return (
        <section className="templates-island ti-island" aria-label="Templates island">
            <div className="templates-inner ti-inner" ref={innerRef}>
                <div className="ti-header">
                    <div className="ti-title">Start with a template</div>
                    <div className="ti-actions">
                        <a
                            href={viewAllHref}
                            className="ti-view-all"
                            onClick={(e) => {
                                if (onViewAll) {
                                    e.preventDefault();
                                    onViewAll();
                                }
                            }}
                        >
                            View all templates →
                        </a>
                    </div>
                </div>

                <div className="templates-row-wrap">
                    <ul className="templates-row ti-row" role="list">
                        {visibleTemplates.map((t, idx) => {
                            const variant = t.variant || "";
                            const legacyVariant =
                                variant.startsWith("template-thumb--") ? variant : `template-thumb--${variant}`.replace(/template-thumb--thumb-/, "template-thumb--");
                            const tiVariant = variant.startsWith("thumb-") ? variant : variant.replace(/^template-thumb--/, "thumb-");
                            const thumbClass = ["template-thumb", "ti-thumb", legacyVariant, tiVariant].filter(Boolean).join(" ");

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
                                                    <div className="ti-thumb-new-inner" aria-hidden>
                                                        {t.badge || "New"}
                                                    </div>
                                                ) : (
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
            </div>
        </section>
    );
}