import { useRef } from "react";
import "./TemplatesIsland.css";

const DEFAULT_TEMPLATES = [
    { id: "tpl-blank", title: "Пустая доска", subtype: "Новое", variant: "template-thumb--blank", badge: "Новое" },
    { id: "tpl-retro", title: "Канбан", subtype: "Шаблон", variant: "thumb-retro" },
    { id: "tpl-year", title: "Планирование спринта", subtype: "Шаблон", variant: "thumb-year" },
    { id: "tpl-brain", title: "Мозговой штурм", subtype: "Шаблон", variant: "thumb-brain" },
    { id: "tpl-roadmap", title: "Дорожная карта", subtype: "Шаблон", variant: "thumb-roadmap" },
    { id: "tpl-sprint", title: "Обучение", subtype: "Шаблон", variant: "thumb-sprint" },
    { id: "tpl-study", title: "Обучение 2", subtype: "Шаблон", variant: "thumb-study" },
];

export interface Template {
    id: string;
    title: string;
    subtype?: string;
    variant?: string;
    badge?: string;
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
                        {templates.map((t, idx) => {
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
                                            onTemplateClick?.(t);
                                        }}
                                    >
                                        <div className={thumbClass}>
                                            <div className="template-thumb-inner ti-thumb-inner" aria-hidden>
                                                {isFirst ? (
                                                    <div className="ti-thumb-new-inner" aria-hidden>
                                                        {t.badge || "Новое"}
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