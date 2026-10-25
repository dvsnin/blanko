import { useEffect, useRef, useState } from "react";
import "./Boards.modals.css";
import ConfirmModal from "./ConfirmModal";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { VALID_ROLES } from "../constants/roles";
import { AGES, type AgeKey } from "../constants/templates";
import type { Team, TeamRole } from "../types";
import TeamMembersTab from "./TeamMembersTab";
import TeacherPicker from "./TeacherPicker";

/*
  TeamSettingsModal - decision based only on team.role.
  role must be one of "owner" | "admin" | "member".
  If role is missing or invalid, we treat the team as broken and hide destructive actions.
*/

export const NEW_TEAM = { create: true } as const;

interface TeamSettingsModalProps {
  team: Partial<Team> & { create?: boolean };
  onClose: () => void;
  /** May return a promise; if it rejects, the modal stays open. */
  onSave: (teamId: string, patch: { name: string; ageGroup: AgeKey | ""; teachers: string }) => void | Promise<unknown>;
  onDelete: (teamId: string) => void | Promise<unknown>;
  onLeave: (teamId: string) => void | Promise<unknown>;
}

export default function TeamSettingsModal({ team, onClose, onSave, onDelete, onLeave }: TeamSettingsModalProps) {
  const [name, setName] = useState(team?.name || "");
  const [ageGroup, setAgeGroup] = useState<AgeKey | "">(team?.ageGroup ?? "");
  const [teachers, setTeachers] = useState(team?.teachers ?? "");
  const [activeTab, setActiveTab] = useState("main");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(team?.name || "");
    setAgeGroup(team?.ageGroup ?? "");
    setTeachers(team?.teachers ?? "");
    setShowDeleteConfirm(false);
    setShowLeaveConfirm(false);
    setActiveTab("main");
  }, [team]);

  useEscapeKey(onClose);

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose?.();
  }

  const role = team?.role as TeamRole | undefined;
  const hasValidRole = !!role && VALID_ROLES.has(role);

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isMember = role === "member";
  const isAdminOrOwner = isAdmin || isOwner;
  const isCreate = !!team?.create || !team?.id;
  const isEmpty = (name || "").trim() === "";

  // «Участники» видят владелец и админ группы; у обычного участника только «Основные».
  const tabs = isAdminOrOwner && !isCreate ? ["main", "members"] : ["main"];
  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab("main");
  }, [role]);

  async function handleSave() {
    const val = (name || "").trim();
    if (!val) return;
    try {
      await onSave?.(team?.id || "", { name: val, ageGroup, teachers: teachers.trim() });
    } catch {
      return;
    }
    onClose?.();
  }

  async function handleDeleteConfirmed() {
    if (!team?.id) return;
    if (isOwner) {
      try {
        await onDelete?.(team.id);
      } catch {
        setShowDeleteConfirm(false);
        return;
      }
    }
    setShowDeleteConfirm(false);
    onClose?.();
  }

  async function handleLeaveConfirmed() {
    if (!team?.id) {
      setShowLeaveConfirm(false);
      onClose?.();
      return;
    }

    if (!isOwner) {
      try {
        await onLeave?.(team.id);
      } catch {
        setShowLeaveConfirm(false);
        return;
      }
    }

    setShowLeaveConfirm(false);
    onClose?.();
  }

  const ageSelect = (
    <select
      className="boards-modal-input"
      value={ageGroup}
      onChange={(e) => setAgeGroup(e.target.value as AgeKey | "")}
      aria-label="Возраст детей"
      disabled={isMember}
    >
      <option value="">Не указан</option>
      {AGES.map((a) => (
        <option key={a.key} value={a.key}>{a.label}</option>
      ))}
    </select>
  );

  const teachersField = <TeacherPicker value={teachers} onChange={setTeachers} disabled={isMember} />;

  if (isCreate) {
    return (
      <div className="boards-modal-backdrop" onMouseDown={handleBackdrop}>
        <div className="boards-modal" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
          <div className="boards-modal-header">
            <h3 className="boards-modal-title">Новая группа</h3>
            <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={onClose}>×</button>
          </div>

          <div className="boards-modal-body">
            <input
              className={`boards-modal-input ${isEmpty ? "boards-modal-input--empty" : ""}`}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") onClose?.();
              }}
              placeholder="Название группы"
              aria-label="Название группы"
            />
            <div className="ts-section" style={{ marginTop: 12 }}>
              <label className="field-label ts-section-label">Возраст детей</label>
              {ageSelect}
            </div>
            <div className="ts-section" style={{ marginTop: 12 }}>
              <label className="field-label ts-section-label">Воспитатели</label>
              {teachersField}
            </div>
          </div>

          <div className="boards-modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid #eef2f7" }}>
            <button
              type="button"
              className="primary-btn"
              onClick={handleSave}
              disabled={isEmpty}
              aria-disabled={isEmpty}
            >
              Создать группу
            </button>
            <button type="button" className="secondary-btn" onClick={onClose}>Отмена</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="boards-modal-backdrop" onMouseDown={handleBackdrop}>
        <div className="boards-modal team-settings-modal team-settings-modal--fixed" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
          <div className="boards-modal-header">
            <h3 className="boards-modal-title">Настройки группы</h3>
            <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={onClose}>×</button>
          </div>

          <div className="team-settings-body">
            {tabs.length > 1 && (
              <nav className="team-settings-sidebar" aria-label="Настройки группы">
                <ul>
                  <li className={`ts-nav-item ${activeTab === "main" ? "active" : ""}`} onClick={() => setActiveTab("main")}>Основные</li>
                  <li className={`ts-nav-item ${activeTab === "members" ? "active" : ""}`} onClick={() => setActiveTab("members")}>Участники</li>
                </ul>
              </nav>
            )}

            <section className="team-settings-content" aria-live="polite">
              {activeTab === "members" && team?.id && (
                <TeamMembersTab teamId={team.id} canManage={isAdminOrOwner} />
              )}

              {activeTab === "main" && (
                <>
                  <div className="ts-section">
                    <label className="field-label ts-section-label">Название группы</label>
                    <input
                      className={`boards-modal-input ${isEmpty ? "boards-modal-input--empty" : ""}`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Название группы"
                      aria-label="Название группы"
                      readOnly={isMember}
                      disabled={isMember}
                    />
                  </div>

                  <div className="ts-section">
                    <label className="field-label ts-section-label">Возраст детей</label>
                    {ageSelect}
                  </div>

                  <div className="ts-section">
                    <label className="field-label ts-section-label">Воспитатели</label>
                    {teachersField}
                  </div>

                  <hr className="ts-divider" />

                  {!hasValidRole && (
                    <div className="ts-section">
                      <p className="ts-section-text">Неверные данные группы - отсутствует role. Обратитесь к бэкенду.</p>
                    </div>
                  )}

                  {hasValidRole && !isOwner && (
                    <>
                      <div className="ts-section">
                        <h4 className="ts-section-title">Покинуть группу</h4>
                        <p className="ts-section-text">Покинув группу, вы потеряете доступ ко всем её доскам в своём аккаунте. При необходимости администратор сможет пригласить вас снова.</p>
                        <div style={{ marginTop: 12 }}>
                          <button className="btn-outlined-danger" onClick={() => setShowLeaveConfirm(true)}>Покинуть группу</button>
                        </div>
                      </div>
                      <hr className="ts-divider" />
                    </>
                  )}

                  {hasValidRole && isOwner && (
                    <div className="ts-section">
                      <h4 className="ts-section-title">Удалить группу</h4>
                      <p className="ts-section-text">Удаление группы удалит все её доски и участники потеряют доступ. Это действие необратимо.</p>
                      <div style={{ marginTop: 12 }}>
                        <button className="btn-outlined-danger" onClick={() => setShowDeleteConfirm(true)}>Удалить группу</button>
                      </div>
                    </div>
                  )}

                  <div className="ts-footer-inside" role="group" aria-label="Основные действия">
                    <div className="boards-modal-footer">
                      {(isAdminOrOwner || isCreate) && (
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleSave}
                          disabled={isEmpty || isMember}
                          aria-disabled={isEmpty || isMember}
                        >
                          Сохранить
                        </button>
                      )}
                      <button type="button" className="secondary-btn" onClick={onClose}>Отмена</button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        compact
        title="Удалить группу?"
        message={<p style={{ margin: 0 }}>Удаление группы <strong>{team?.name || "группы"}</strong> приведёт к удалению всех её досок и потере доступа у участников. Это действие нельзя отменить.</p>}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmModal
        isOpen={showLeaveConfirm}
        compact
        title="Покинуть группу?"
        message={<p style={{ margin: 0 }}>Вы потеряете доступ ко всем доскам группы <strong>{team?.name}</strong>. Администратор сможет пригласить вас снова при необходимости.</p>}
        confirmLabel="Покинуть"
        cancelLabel="Отмена"
        danger
        onConfirm={handleLeaveConfirmed}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </>
  );
}
