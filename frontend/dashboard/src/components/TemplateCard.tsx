import { useState } from "react";
import "./TemplateCard.css";
import StarToggle from "./StarToggle";
import TemplateMenu from "./TemplateMenu";
import { AGES } from "../constants/templates";
import { templateGlyph, topicStyle } from "../utils/templates";
import type { Template } from "../types";


export interface TemplateCardProps {
  template: Template;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: () => void;
  onToggleStar: () => void;
  notify: (message: string) => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function agesLabel(ages: Template["ages"]): string {
  if (ages.length >= AGES.length) return "все возрасты";
  const list = AGES.filter((a) => ages.includes(a.key)).map((a) => a.key);
  if (list.length === 0) return "";
  return `${list.join(", ")} ${list[list.length - 1].endsWith("3-4") ? "года" : "лет"}`;
}

export default function TemplateCard({
  template: t, canCreate, onCreate, onOpen, onToggleStar, notify, onDuplicate, onEdit, onDelete,
}: TemplateCardProps) {
  const ts = topicStyle(t.topic);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article
      className={`tpl-card${menuOpen ? " tpl-card--menu-open" : ""}`}
      data-template-id={t.id}
      onMouseLeave={() => { if (menuOpen) setMenuOpen(false); }}
    >
      <div className="tpl-card__cover" style={{ background: ts.bg }}>
        <span className="tpl-card__shape tpl-card__shape--a" style={{ background: ts.dot }} aria-hidden="true" />
        <span className="tpl-card__shape tpl-card__shape--b" style={{ background: ts.dot }} aria-hidden="true" />
        <span className="tpl-card__glyph" style={{ color: ts.color }} aria-hidden="true">{templateGlyph(t)}</span>
        <span className="tpl-card__duration">{t.durationMin} мин</span>
      </div>
      {/* Вне обложки, чтобы меню не обрезалось её overflow */}
      <span className="tpl-card__corner">
        <StarToggle isStarred={t.isStarred} onToggle={onToggleStar} notify={notify} variant="list" size={36} />
        <TemplateMenu
          template={t}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </span>
      <div className="tpl-card__body">
        <h3 className="tpl-card__title" title={t.name}>{t.name}</h3>
        <p className="tpl-card__meta">
          <span style={{ color: ts.color, fontWeight: 700 }}>{ts.label}</span>
          {" · "}{agesLabel(t.ages)}
        </p>
        {t.source === "own" && t.authorName && (
          <p className="tpl-card__meta tpl-card__author" title={t.authorName}>{t.authorName}</p>
        )}
        <div className="tpl-card__actions">
          <button
            type="button"
            className="btn btn--soft tpl-card__create"
            disabled={!canCreate}
            title={canCreate ? undefined : "Сначала создайте группу"}
            onClick={onCreate}
          >
            <svg className="tpl-card__plus" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Создать доску
          </button>
          <button type="button" className="btn btn--ghost" onClick={onOpen}>Открыть</button>
        </div>
      </div>
    </article>
  );
}
