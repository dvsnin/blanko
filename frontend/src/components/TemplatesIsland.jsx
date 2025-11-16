import React, { useEffect, useRef, useState } from "react";
import TemplateThumb from "./TemplateThumb";
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

    const handleTemplateClick = (templateId) => {
        console.log("Template click:", templateId);
    };

    return (
        <section className="templates-island ti-island" aria-label="Templates island">
            <div className="templates-inner ti-inner" ref={innerRef}>
                <ul className="templates-row ti-row" role="list">
                    {visibleTemplates.map((t, idx) => (
                        <TemplateThumb 
                            key={t.id} 
                            template={t} 
                            index={idx} 
                            onClick={handleTemplateClick}
                        />
                    ))}
                </ul>
            </div>
        </section>
    );
}