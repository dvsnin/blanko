import { useState } from "react";
import "./Boards.modals.css";
import ConfirmModal from "./ConfirmModal";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { AGES, TOPICS, type AgeKey, type TopicKey } from "../constants/templates";
import type { Template, TemplateInput } from "../types";

/* Карточка шаблона: создание и правка. */

export const NEW_TEMPLATE = { create: true } as const;

export interface TemplateSettingsModalProps {
  template: Template | typeof NEW_TEMPLATE;
  /** Предзаполнение при создании. */
  initial?: Partial<TemplateInput>;
  onClose: () => void;
  /** При ошибке модал остаётся открытым. */
  onSave: (input: TemplateInput) => void | Promise<unknown>;
  onDelete?: () => void | Promise<unknown>;
}

const DESC_MAX = 500;
const DURATION_MIN = 5;
const DURATION_MAX = 120;

export default function TemplateSettingsModal({ template, initial, onClose, onSave, onDelete }: TemplateSettingsModalProps) {
  const isCreate = "create" in template;
  const src = isCreate ? undefined : template;
  const [name, setName] = useState(src?.name ?? initial?.name ?? "");
  const [description, setDescription] = useState(src?.description ?? initial?.description ?? "");
  const [topic, setTopic] = useState<TopicKey>(src?.topic ?? initial?.topic ?? "math");
  const [ages, setAges] = useState<AgeKey[]>(src?.ages ?? initial?.ages ?? []);
  const [durationMin, setDurationMin] = useState<number>(src?.durationMin ?? initial?.durationMin ?? 20);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEscapeKey(onClose, !confirmDelete);

  const trimmed = name.trim();
  const durationOk = Number.isInteger(durationMin) && durationMin >= DURATION_MIN && durationMin <= DURATION_MAX;
  const canSave = !saving && trimmed !== "" && ages.length > 0 && durationOk && description.length <= DESC_MAX;

  function toggleAge(key: AgeKey) {
    setAges((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : AGES.map((a) => a.key).filter((a) => a === key || prev.includes(a))));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ name: trimmed, description: description.trim(), topic, ages, durationMin });
    } catch {
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    try {
      await onDelete?.();
    } catch {
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
    onClose();
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      <div className="boards-modal-backdrop" onMouseDown={handleBackdrop}>
        <div className="boards-modal" role="dialog" aria-label={isCreate ? "Новый шаблон" : "Карточка шаблона"} onMouseDown={(e) => e.stopPropagation()}>
          <div className="boards-modal-header">
            <h3 className="boards-modal-title">{isCreate ? (initial?.name ? "Сохранить как шаблон" : "Новый шаблон") : "Карточка шаблона"}</h3>
            <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={onClose}>×</button>
          </div>

          <div className="boards-modal-body">
            <div className="ts-section">
              <label className="field-label ts-section-label" htmlFor="tpl-name">Название</label>
              <input
                id="tpl-name"
                className={`boards-modal-input ${trimmed === "" ? "boards-modal-input--empty" : ""}`}
                value={name}
                autoFocus
                maxLength={255}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Счёт до 5 с яблоками"
              />
            </div>
            <div className="ts-section">
              <label className="field-label ts-section-label" htmlFor="tpl-desc">Описание</label>
              <textarea
                id="tpl-desc"
                className="boards-modal-input tpl-modal__textarea"
                rows={3}
                value={description}
                maxLength={DESC_MAX}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что делают дети на занятии"
              />
              <p className="ts-section-text" style={{ marginTop: 4 }}>{description.length} / {DESC_MAX}</p>
            </div>
            <div className="ts-section">
              <label className="field-label ts-section-label" htmlFor="tpl-topic">Тема</label>
              <select id="tpl-topic" className="boards-modal-input" value={topic} onChange={(e) => setTopic(e.target.value as TopicKey)}>
                {TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="ts-section">
              <span className="field-label ts-section-label">Возраст</span>
              <div className="tpl-ages-pick" role="group" aria-label="Возраст">
                {AGES.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className="chip tpl-ages-pick__chip"
                    aria-pressed={ages.includes(a.key)}
                    onClick={() => toggleAge(a.key)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {ages.length === 0 && <p className="ts-section-text" style={{ marginTop: 4 }}>Выберите хотя бы один возраст</p>}
            </div>
            <div className="ts-section">
              <label className="field-label ts-section-label" htmlFor="tpl-duration">Длительность, мин</label>
              <input
                id="tpl-duration"
                className="boards-modal-input"
                type="number"
                min={DURATION_MIN}
                max={DURATION_MAX}
                step={5}
                value={Number.isNaN(durationMin) ? "" : durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
                style={{ width: 120 }}
              />
            </div>
          </div>

          <div className="boards-modal-footer tpl-modal__footer">
            {!isCreate && onDelete && (
              <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirmDelete(true)}>Удалить шаблон</button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="secondary-btn" onClick={onClose}>Отмена</button>
            <button type="button" className="primary-btn" onClick={handleSave} disabled={!canSave} aria-disabled={!canSave}>
              {isCreate ? "Сохранить шаблон" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmDelete}
        compact
        danger
        title={`Удалить шаблон «${src?.name ?? ""}»?`}
        message={<p style={{ margin: 0 }}>Доски, созданные из него, останутся.</p>}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
