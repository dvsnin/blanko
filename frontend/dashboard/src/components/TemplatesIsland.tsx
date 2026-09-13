import { useRef } from "react";
import "./TemplatesIsland.css";

// Тематические шаблоны занятий. Названия короткие намеренно: подпись
// рендерится внутри миниатюры шириной ~114px, длинное название туда не влезет.
const DEFAULT_TEMPLATES = [
    { id: "tpl-count", title: "Счёт до 10", subtype: "Шаблон", variant: "thumb-count" },
    { id: "tpl-alphabet", title: "Алфавит", subtype: "Шаблон", variant: "thumb-alphabet" },
    { id: "tpl-seasons", title: "Времена года", subtype: "Шаблон", variant: "thumb-seasons" },
    { id: "tpl-shapes", title: "Геом. фигуры", subtype: "Шаблон", variant: "thumb-shapes" },
    { id: "tpl-traffic", title: "ПДД для детей", subtype: "Шаблон", variant: "thumb-traffic" },
    { id: "tpl-emotions", title: "Эмоции", subtype: "Шаблон", variant: "thumb-emotions" },
];

export interface Template {
    id: string;
    title: string;
    subtype?: string;
    variant?: string;
}

interface TemplatesIslandProps {
    templates?: Template[];
    itemWidth?: number;
    gap?: number;
    viewAllHref?: string;
    onViewAll?: (() => void) | null;
    onTemplateClick?: ((template: Template) => void) | null;
}

export default function TemplatesIsland({
                                            templates = DEFAULT_TEMPLATES,
                                            itemWidth = 180,
                                            gap = 22,
                                            viewAllHref = "#/templates",
                                            onViewAll = null,
                                            onTemplateClick = null,
                                        }: TemplatesIslandProps) {
    const innerRef = useRef(null);

    return (
        <section className="templates-island ti-island" aria-label="Шаблоны">
            <div className="templates-inner ti-inner" ref={innerRef}>
                <div className="ti-header">
                    <div className="ti-title">Начните с шаблона</div>
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
                            Все шаблоны →
                        </a>
                    </div>
                </div>

                <div className="templates-row-wrap">
                    <ul className="templates-row ti-row" role="list">
                        {templates.map((t) => {
                            const variant = t.variant || "";
                            const legacyVariant =
                                variant.startsWith("template-thumb--") ? variant : `template-thumb--${variant}`.replace(/template-thumb--thumb-/, "template-thumb--");
                            const tiVariant = variant.startsWith("thumb-") ? variant : variant.replace(/^template-thumb--/, "thumb-");
                            const thumbClass = ["template-thumb", "ti-thumb", legacyVariant, tiVariant].filter(Boolean).join(" ");

                            return (
                                <li key={t.id} className="template-item ti-item" role="listitem" aria-hidden={false}>
                                    <button
                                        type="button"
                                        className="template-thumb-button ti-thumb-button"
                                        aria-label={`Открыть шаблон: ${t.title}`}
                                        onClick={() => {
                                            onTemplateClick?.(t);
                                        }}
                                    >
                                        <div className={thumbClass}>
                                            <div className="template-thumb-inner ti-thumb-inner" aria-hidden>
                                                <div className="ti-thumb-caption-inner" aria-hidden>
                                                    {t.title}
                                                </div>
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