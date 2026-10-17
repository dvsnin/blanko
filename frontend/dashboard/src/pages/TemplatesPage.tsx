import { useState } from "react";
import "./TemplatesPage.css";
import { AGES, TOPICS, type AgeKey, type TopicKey, type Template } from "../constants/templates";
import { filterTemplates, topicCounts, topicStyle } from "../utils/templates";
import { colorForId, initialsOf } from "../utils/cover";
import "../components/BoardCover.css";
import { openBoardWindow } from "../utils/openBoard";
import { navigate } from "../hooks/useHashRoute";
import { useToast } from "../hooks/useToast";
import { useTeams } from "../contexts/TeamsContext";

export default function TemplatesPage({ initialAge }: { initialAge?: AgeKey }) {
  const { activeTeam, createBoard, markBoardOpened } = useTeams();
  const { toastMessage, toastVisible, showToast } = useToast();
  const [q, setQ] = useState("");
  const [age, setAge] = useState<AgeKey | "all">(initialAge ?? "all");
  const [topic, setTopic] = useState<TopicKey | "all">("all");

  const list = filterTemplates(q, age, topic);
  const counts = topicCounts(q, age);
  const dirty = q.trim() !== "" || age !== "all" || topic !== "all";
  const groupAge = activeTeam?.ageGroup;

  const reset = () => { setQ(""); setAge("all"); setTopic("all"); };

  const create = (t: Template) => {
    void (async () => {
      const board = await createBoard(t.title, t.id);
      if (board) {
        markBoardOpened(board.id);
        openBoardWindow(board);
        navigate({ name: "boards" });
      } else {
        showToast("Не удалось создать доску");
      }
    })();
  };

  return (
    <main className="page tpl-page">
      <div className="tpl-head">
        <div className="tpl-head__text">
        <h1 className="tpl-title">Шаблоны занятий</h1>
        <p className="tpl-sub">
          {activeTeam
            ? `Готовые занятия для детей. Новая доска из шаблона попадёт в группу «${activeTeam.name}».`
            : "Готовые занятия для детей. Сначала создайте группу, чтобы добавлять доски."}
        </p>
        </div>
      <label className="input input--search tpl-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input
          type="text"
          aria-label="Поиск шаблонов"
          placeholder="Например: счёт, буква, животные…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" className="input__clear" aria-label="Очистить поиск" onClick={() => setQ("")}>×</button>
        )}
      </label>
      </div>

      <div className="tpl-ages">
        <span className="tpl-ages__label">Возраст</span>
        <button type="button" className="tpl-pill" aria-pressed={age === "all"} onClick={() => setAge("all")}>Все возрасты</button>
        {AGES.map((a) => (
          <button key={a.key} type="button" className="tpl-pill" aria-pressed={age === a.key} onClick={() => setAge(a.key)}>{a.label}</button>
        ))}
        <span className="tpl-spacer" />
        {groupAge && activeTeam && (
          <button type="button" className="chip tpl-asgroup" onClick={() => setAge(groupAge)}>
            <span className={`tpl-asgroup__mark cover--${colorForId(activeTeam.id)}`} aria-hidden>{initialsOf(activeTeam.name)}</span>
            Как у группы «{activeTeam.name}»
          </button>
        )}
      </div>

      <div className="tpl-body">
        <nav className="tpl-nav" aria-label="Тематика">
          <div className="tpl-nav__head">Тематика</div>
          <button type="button" className="tpl-topic" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>
            <span className="tpl-dot" style={{ background: "var(--ink)" }} />
            <span className="tpl-topic__label">Все</span>
            <span className="chip tpl-count">{counts.all}</span>
          </button>
          {TOPICS.map((t) => (
            <button key={t.key} type="button" className="tpl-topic" aria-pressed={topic === t.key} onClick={() => setTopic(t.key)}>
              <span className="tpl-dot" style={{ background: t.dot }} />
              <span className="tpl-topic__label">{t.label}</span>
              <span className="chip tpl-count">{counts[t.key]}</span>
            </button>
          ))}
        </nav>

        <section className="tpl-results">
          <div className="tpl-results__bar">
            <span className="tpl-found">Найдено: {list.length}</span>
            {dirty && <button type="button" className="chip tpl-reset" onClick={reset}>Сбросить фильтры</button>}
          </div>

          {list.length === 0 ? (
            <div className="tpl-empty">Таких шаблонов нет. Попробуйте другой возраст или тему, либо начните с пустой доски.</div>
          ) : (
            <div className="tpl-grid">
              {list.map((t) => {
                const ts = topicStyle(t.topic);
                return (
                  <article key={t.id} className="tpl-card">
                    <div className="tpl-card__preview" style={{ background: ts.bg }}>
                      <span className="tpl-shape tpl-shape--a" style={{ background: ts.dot }} aria-hidden="true" />
                      <span className="tpl-shape tpl-shape--b" style={{ background: ts.dot }} aria-hidden="true" />
                      <span className="tpl-card__glyph" style={{ color: ts.color }} aria-hidden="true">{t.glyph}</span>
                      <span className="tpl-card__duration">{t.duration}</span>
                    </div>
                    <div className="tpl-card__body">
                      <h3 className="tpl-card__title">{t.title}</h3>
                      <p className="tpl-card__desc">{t.desc}</p>
                      <div className="tpl-card__chips">
                        <span className="chip" style={{ background: ts.bg, color: ts.color }}>{ts.label}</span>
                        {AGES.filter((a) => t.ages.includes(a.key)).map((a) => (
                          <span key={a.key} className={`chip tpl-agechip${age === a.key ? " is-on" : ""}`}>{a.label}</span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn tpl-create"
                        disabled={!activeTeam}
                        title={activeTeam ? undefined : "Сначала создайте группу"}
                        onClick={() => create(t)}
                      >
                        Создать доску
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </main>
  );
}
