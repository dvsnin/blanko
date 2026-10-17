import { useState } from "react";
import "./TemplatesPage.css";
import "../components/BoardCover.css";
import ConfirmModal from "../components/ConfirmModal";
import TemplateCard from "../components/TemplateCard";
import TemplateSettingsModal, { NEW_TEMPLATE } from "../components/TemplateSettingsModal";
import { AGES, TOPICS, type AgeKey, type TopicKey } from "../constants/templates";
import { useTeams } from "../contexts/TeamsContext";
import { useTemplates } from "../contexts/TemplatesContext";
import { navigate } from "../hooks/useHashRoute";
import { useToast } from "../hooks/useToast";
import { openBoardWindow, openTemplateWindow } from "../utils/openBoard";
import { filterTemplates, topicCounts } from "../utils/templates";
import type { Template } from "../types";

/* Экран «Шаблоны»: возраст, тематика слева, карточки, избранные первыми. */

export default function TemplatesPage({ initialAge }: { initialAge?: AgeKey }) {
  const { activeTeam, createBoard, markBoardOpened } = useTeams();
  const { templates, loading, error, refresh, createTemplate, toggleStarTemplate, duplicateTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { toastMessage, toastVisible, showToast } = useToast();
  const [q, setQ] = useState("");
  const [age, setAge] = useState<AgeKey | "all">(initialAge ?? "all");
  const [topic, setTopic] = useState<TopicKey | "all">("all");
  const [onlyOwn, setOnlyOwn] = useState(false);
  const [editing, setEditing] = useState<Template | typeof NEW_TEMPLATE | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  // «Только наши» без счётчика: при пагинации его не посчитать на клиенте.
  const base = onlyOwn ? templates.filter((t) => t.source === "own") : templates;
  // Избранные первыми, дальше порядок сервера (по алфавиту).
  const list = filterTemplates(base, q, age, topic).sort((a, b) => Number(b.isStarred) - Number(a.isStarred));
  const counts = topicCounts(base, q, age);
  const dirty = q.trim() !== "" || age !== "all" || topic !== "all" || onlyOwn;
  const groupAge = activeTeam?.ageGroup;

  const reset = () => { setQ(""); setAge("all"); setTopic("all"); setOnlyOwn(false); };

  const create = (t: Template) => {
    void (async () => {
      const board = await createBoard(t.name, t.id);
      if (board) {
        markBoardOpened(board.id);
        openBoardWindow(board);
        navigate({ name: "boards" });
      } else {
        showToast("Не удалось создать доску");
      }
    })();
  };

  const duplicate = (t: Template) => {
    void (async () => {
      try {
        await duplicateTemplate(t.id);
        showToast("Шаблон продублирован");
      } catch {
        showToast("Не удалось продублировать шаблон");
      }
    })();
  };

  async function confirmDelete() {
    const t = deleting;
    setDeleting(null);
    if (!t) return;
    try {
      await deleteTemplate(t.id);
      showToast("Шаблон удалён");
    } catch {
      showToast("Не удалось удалить шаблон");
    }
  }

  const empty = !loading && !error && templates.length === 0;

  return (
    <main className="page tpl-page">
      <div className="tpl-head">
        <div className="tpl-head__text">
          <h1 className="tpl-title">Шаблоны занятий</h1>
          <p className="tpl-sub">
            {activeTeam
              ? `Новая доска попадёт в группу «${activeTeam.name}»`
              : "Сначала создайте группу, чтобы добавлять доски"}
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
        <button type="button" className="btn btn--soft" onClick={() => setEditing(NEW_TEMPLATE)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Создать шаблон
        </button>
      </div>

      <div className="tpl-ages">
        <span className="tpl-ages__label">Возраст</span>
        <button type="button" className="tpl-pill" aria-pressed={age === "all"} onClick={() => setAge("all")}>Все</button>
        {AGES.map((a) => (
          <button key={a.key} type="button" className="tpl-pill" aria-pressed={age === a.key} onClick={() => setAge(a.key)}>
            {a.label}
            {groupAge === a.key && <span className="tpl-pill__tag">как у группы</span>}
          </button>
        ))}
        <span className="tpl-spacer" />
        <button
          type="button"
          className="tpl-pill tpl-pill--own"
          aria-pressed={onlyOwn}
          title="Показать только шаблоны, созданные в нашем саду"
          onClick={() => setOnlyOwn((v) => !v)}
        >
          Только наши
        </button>
      </div>

      {loading && templates.length === 0 ? (
        <div className="tpl-empty" role="status" aria-live="polite">Загружаем шаблоны…</div>
      ) : error && templates.length === 0 ? (
        <div className="tpl-empty" role="alert">
          <p className="tpl-empty__text">Не удалось загрузить шаблоны</p>
          <button type="button" className="btn btn--ghost" onClick={() => void refresh()}>Повторить</button>
        </div>
      ) : empty ? (
        <div className="tpl-empty">Шаблонов пока нет. Сохраните любую доску как шаблон через её меню.</div>
      ) : (
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
                {list.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    canCreate={!!activeTeam}
                    onCreate={() => create(t)}
                    onOpen={() => openTemplateWindow(t)}
                    onToggleStar={() => void toggleStarTemplate(t.id)}
                    notify={showToast}
                    onDuplicate={() => duplicate(t)}
                    onEdit={() => setEditing(t)}
                    onDelete={() => setDeleting(t)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {editing && (
        <TemplateSettingsModal
          template={editing}
          initial={"create" in editing && groupAge ? { ages: [groupAge] } : undefined}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              if ("create" in editing) {
                await createTemplate(input);
                showToast("Шаблон создан");
              } else {
                await updateTemplate(editing.id, input);
                showToast("Шаблон сохранён");
              }
            } catch (e) {
              showToast("Не удалось сохранить шаблон");
              throw e;
            }
          }}
          onDelete={"create" in editing ? undefined : async () => {
            try {
              await deleteTemplate(editing.id);
              showToast("Шаблон удалён");
            } catch (e) {
              showToast("Не удалось удалить шаблон");
              throw e;
            }
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        compact
        danger
        title={`Удалить шаблон «${deleting?.name ?? ""}»?`}
        message={<p style={{ margin: 0 }}>Доски, созданные из него, останутся.</p>}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </main>
  );
}
