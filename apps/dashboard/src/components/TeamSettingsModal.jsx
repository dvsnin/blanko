import React, { useEffect, useRef, useState } from "react";
import "./TeamsPanel.css";
import "./Boards.modals.css";
import ConfirmModal from "./ConfirmModal";

/*
  TeamSettingsModal — decision based only on team.role.
  role must be one of "owner", "admin", "member".
  If role is missing or invalid, we treat the team as broken and hide destructive actions.

  Fix: make leave behaviour robust — ensure onLeave called reliably and modal closed cleanly.
*/

const VALID_ROLES = new Set(["owner", "admin", "member"]);

export default function TeamSettingsModal({ team = {}, onClose, onSave, onDelete, onLeave }) {
    const [name, setName] = useState(team?.name || "");
    const [activeTab, setActiveTab] = useState("main");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        setName(team?.name || "");
        setShowDeleteConfirm(false);
        setShowLeaveConfirm(false);
        setActiveTab("main");
    }, [team]);

    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose && onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function handleBackdrop(e) {
        if (e.target === e.currentTarget) onClose && onClose();
    }

    const role = team?.role;
    const hasValidRole = !!role && VALID_ROLES.has(role);

    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isMember = role === "member";
    const isAdminOrOwner = isAdmin || isOwner;
    const isCreate = !!team?.create || !team?.id;
    const isEmpty = (name || "").trim() === "";

    // Tabs: members should see only "main"
    const tabs = isMember ? ["main"] : ["main", "members", "perms", "invites", "audit"];
    useEffect(() => {
        if (!tabs.includes(activeTab)) setActiveTab("main");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role]);

    function handleSave() {
        const val = (name || "").trim();
        if (!val) return;
        if (typeof onSave === "function") onSave(team?.id, val);
        if (typeof onClose === "function") onClose();
    }

    function handleDeleteConfirmed() {
        if (!team?.id) return;
        if (isOwner && typeof onDelete === "function") {
            // call onDelete synchronously — UI will update accordingly
            onDelete(team.id);
        }
        setShowDeleteConfirm(false);
        onClose && onClose();
    }

    function handleLeaveConfirmed() {
        // Robust leave: call onLeave if provided and we're not owner,
        // then close confirm + modal. Use synchronous call to onLeave,
        // but close modal afterwards to avoid visual race.
        if (!team?.id) {
            setShowLeaveConfirm(false);
            onClose && onClose();
            return;
        }

        if (!isOwner && typeof onLeave === "function") {
            try {
                onLeave(team.id);
            } catch (err) {
                // If onLeave throws, still close modal to avoid blocking UI.
                // (No console logs here to keep output clean.)
            }
        }

        setShowLeaveConfirm(false);
        onClose && onClose();
    }

    if (isCreate) {
        return (
            <div className="boards-modal-backdrop" onMouseDown={handleBackdrop}>
                <div className="boards-modal" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="boards-modal-header">
                        <h3 className="boards-modal-title">Новая команда</h3>
                        <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={() => onClose && onClose()}>
                            ×
                        </button>
                    </div>

                    <div className="boards-modal-body">
                        <input
                            className={`boards-modal-input ${isEmpty ? "boards-modal-input--empty" : ""}`}
                            value={name}
                            autoFocus
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave();
                                if (e.key === "Escape") onClose && onClose();
                            }}
                            placeholder="Название команды"
                            aria-label="Название команды"
                        />
                    </div>

                    <div className="boards-modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid #eef2f7" }}>
                        <button
                            type="button"
                            className="primary-btn"
                            onClick={handleSave}
                            disabled={isEmpty}
                            aria-disabled={isEmpty}
                        >
                            Создать команду
                        </button>

                        <button type="button" className="secondary-btn" onClick={() => onClose && onClose()}>
                            Отмена
                        </button>
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
                        <h3 className="boards-modal-title">Настройки команды</h3>
                        <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={() => onClose && onClose()}>×</button>
                    </div>

                    <div className="team-settings-body">
                        <nav className="team-settings-sidebar" aria-label="Настройки команды">
                            <ul>
                                {tabs.includes("main") && <li className={`ts-nav-item ${activeTab === "main" ? "active" : ""}`} onClick={() => setActiveTab("main")}>Основные</li>}
                                {/* only render other items when allowed (not for member) */}
                                {!isMember && (
                                    <>
                                        <li className={`ts-nav-item ${activeTab === "members" ? "active" : ""}`} onClick={() => setActiveTab("members")}>Участники</li>
                                        <li className={`ts-nav-item ${activeTab === "perms" ? "active" : ""}`} onClick={() => setActiveTab("perms")}>Разрешения</li>
                                        <li className={`ts-nav-item ${activeTab === "invites" ? "active" : ""}`} onClick={() => setActiveTab("invites")}>Приглашения</li>
                                        <li className={`ts-nav-item ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>Аудит логи</li>
                                    </>
                                )}
                            </ul>
                        </nav>

                        <section className="team-settings-content" aria-live="polite">
                            {activeTab === "main" && (
                                <>
                                    <div className="ts-section">
                                        <label className="ts-section-label">Название команды</label>
                                        <input
                                            className={`boards-modal-input ${isEmpty ? "boards-modal-input--empty" : ""}`}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Название команды"
                                            aria-label="Название команды"
                                            readOnly={isMember}           // members cannot edit name
                                            disabled={isMember}           // visually indicate blocked state
                                        />
                                    </div>

                                    <hr className="ts-divider" />

                                    {!hasValidRole && (
                                        <div className="ts-section">
                                            <p className="ts-section-text">Неверные данные команды — отсутствует role. Обратитесь к бэкенду.</p>
                                        </div>
                                    )}

                                    {/* Покинуть: visible to non-owners (admin + member) */}
                                    {hasValidRole && !isOwner && (
                                        <>
                                            <div className="ts-section">
                                                <h4 className="ts-section-title">Покинуть команду</h4>
                                                <p className="ts-section-text">Покинув команду, вы потеряете доступ ко всем её доскам в своём аккаунте. При необходимости администратор сможет пригласить вас снова.</p>
                                                <div style={{ marginTop: 12 }}>
                                                    <button className="btn-outlined-danger" onClick={() => setShowLeaveConfirm(true)}>Покинуть команду</button>
                                                </div>
                                            </div>
                                            <hr className="ts-divider" />
                                        </>
                                    )}

                                    {/* Удалить: visible only to owner */}
                                    {hasValidRole && isOwner && (
                                        <>
                                            <div className="ts-section">
                                                <h4 className="ts-section-title">Удалить команду</h4>
                                                <p className="ts-section-text">Удаление команды удалит все её доски и участники потеряют доступ. Это действие необратимо.</p>
                                                <div style={{ marginTop: 12 }}>
                                                    <button className="btn-outlined-danger" onClick={() => setShowDeleteConfirm(true)}>Удалить команду</button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="ts-footer-inside" role="group" aria-label="Основные действия">
                                        <div className="boards-modal-footer">
                                            {/* Save/edit limited to admins and owners only */}
                                            {(isAdminOrOwner || isCreate) && (
                                                <button type="button" className="primary-btn" onClick={handleSave} disabled={isEmpty || isMember} aria-disabled={isEmpty || isMember}>
                                                    {isCreate ? "Создать команду" : "Сохранить"}
                                                </button>
                                            )}
                                            <button type="button" className="secondary-btn" onClick={() => onClose && onClose()}>Отмена</button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === "members" && !isMember && <div className="ts-placeholder">Список участников (заглушка)</div>}
                            {activeTab === "perms" && !isMember && <div className="ts-placeholder">Управление разрешениями (заглушка)</div>}
                            {activeTab === "invites" && !isMember && <div className="ts-placeholder">Приглашения (заглушка)</div>}
                            {activeTab === "audit" && !isMember && <div className="ts-placeholder">Аудит логи (заглушка)</div>}
                        </section>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                compact={true}
                title="Удалить команду?"
                message={<p style={{ margin: 0 }}>Удаление команды <strong>{team?.name || "команды"}</strong> приведёт к удалению всех её досок и потере доступа у участников. Это действие нельзя отменить.</p>}
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                danger={true}
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <ConfirmModal
                isOpen={showLeaveConfirm}
                compact={true}
                title="Покинуть команду?"
                message={<p style={{ margin: 0 }}>Вы потеряете доступ ко всем доскам команды <strong>{team.name}</strong>. Администратор сможет пригласить вас снова при необходимости.</p>}
                confirmLabel="Покинуть"
                cancelLabel="Отмена"
                danger={true}
                onConfirm={handleLeaveConfirmed}
                onCancel={() => setShowLeaveConfirm(false)}
            />
        </>
    );
}