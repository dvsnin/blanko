import "./TemplatesStrip.css";
import type { AgeKey, Template } from "../constants/templates";
import { ageLabel, templatesForAge, topicStyle } from "../utils/templates";
import { routeToHash } from "../hooks/useHashRoute";

interface Props {
  age?: AgeKey;
  onBlank: () => void;
  onTemplate: (t: Template) => void;
}

export default function TemplatesStrip({ age, onBlank, onTemplate }: Props) {
  const label = ageLabel(age);
  return (
    <section className="templates-strip" aria-label="Шаблоны занятий">
      <div className="templates-strip__head">
        <h2 className="templates-strip__title">Начать занятие с шаблона</h2>
        {age && label && <span className="chip chip--muted">для {label}</span>}
        <span className="templates-strip__spacer" />
        <a className="templates-strip__all" href={routeToHash({ name: "templates", age })}>Все шаблоны →</a>
      </div>
      <div className="templates-strip__grid">
        <button type="button" className="templates-strip__card templates-strip__card--blank" onClick={onBlank}>
          <span className="templates-strip__icon templates-strip__icon--blank" aria-hidden="true">+</span>
          <span className="templates-strip__name">Пустая доска</span>
          <span className="templates-strip__sub">Чистый холст</span>
        </button>
        {templatesForAge(age).map((t) => {
          const topic = topicStyle(t.topic);
          return (
            <button type="button" key={t.id} className="templates-strip__card" onClick={() => onTemplate(t)}>
              <span className="templates-strip__icon" style={{ background: topic.bg, color: topic.color }} aria-hidden="true">{t.glyph}</span>
              <span className="templates-strip__name">{t.title}</span>
              <span className="templates-strip__sub">{topic.label} · {t.duration}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
