import { useEffect, useState } from "react";
import "./TemplateCard.css";
import { shortName } from "../utils/shortName";
import StarToggle from "./StarToggle";
import TemplateMenu from "./TemplateMenu";
import { AGES } from "../constants/templates";
import { topicStyle } from "../utils/templates";
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
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewUrl = `/app/preview/templates/${t.id}?v=${encodeURIComponent(t.updatedAt || "")}`;
  useEffect(() => { setPreviewLoaded(false); setPreviewFailed(false); }, [previewUrl]);
  return (
    <article
      className={`tpl-card${menuOpen ? " tpl-card--menu-open" : ""}${t.isStarred ? " tpl-card--starred" : ""}`}
      data-template-id={t.id}
      onMouseLeave={() => { if (menuOpen) setMenuOpen(false); }}
      onClick={onOpen}
    >
      <div className="tpl-card__cover" style={{ background: ts.bg }} aria-hidden="true">
        <span className="tpl-card__shape tpl-card__shape--a" style={{ background: ts.dot }} />
        <span className="tpl-card__shape tpl-card__shape--b" style={{ background: ts.dot }} />
        {!previewFailed && (
          <img
            className={`tpl-card__preview${previewLoaded ? " is-loaded" : ""}`}
            src={previewUrl}
            alt=""
            loading="lazy"
            onLoad={() => setPreviewLoaded(true)}
            onError={() => setPreviewFailed(true)}
          />
        )}
      </div>
      {/* Вне обложки, чтобы меню не обрезалось её overflow */}
      <span className="tpl-card__corner" onClick={(e) => e.stopPropagation()}>
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
        <p className="tpl-card__meta" title={t.source === "own" && t.authorName ? t.authorName : undefined}>
          <span style={{ color: ts.color, fontWeight: 700 }}>{ts.label}</span>
          {" · "}{agesLabel(t.ages)}{" · "}{t.durationMin} мин
          {t.source === "own" && t.authorName && <>{" · "}{shortName(t.authorName)}</>}
        </p>
        <div className="tpl-card__actions" onClick={(e) => e.stopPropagation()}>
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
