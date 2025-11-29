import React, { useEffect, useRef, useState } from "react";
import "./TeamsPanel.css";
import "./Boards.modals.css";
import ConfirmModal from "./ConfirmModal";

/*
 TeamSettingsModal — updated access rules:
  - Only owner (team.role === "owner") can delete the team.
  - Admins (role === "admin") can manage settings and can leave the team (like members).
  - Members can leave, but cannot delete.
  - Owner does not see "Покинуть команду" in this UI (to avoid accidental ownership loss).
  - Creation flow (isCreate) unchanged.
*/

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

    const role = team?.role || "";
    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isAdminOrOwner = isAdmin || isOwner;
    const isCreate = !!team?.create || !team?.id;
    const isEmpty = (name || "").trim() === "";

    function handleSave() {
        const val = (name || "").trim();
        if (!val) return;
        if (typeof onSave === "function") onSave(team?.id, val);
        if (typeof onClose === "function") onClose();
    }

    function handleDeleteConfirmed() {
        if (!team?.id) return;
        // only owner can trigger delete — caller should ensure that
        if (isOwner) {
            if (typeof onDelete === "function") onDelete(team.id);
        }
        setShowDeleteConfirm(false);
        onClose && onClose();
    }

    function handleLeaveConfirmed() {
        if (!team?.id) return;
        // admins/members can leave
        if (!isOwner) {
            if (typeof onLeave === "function") onLeave(team.id);
        }
        setShowLeaveConfirm(false);
        onClose && onClose();
    }

    // Minimal "create" modal (no duplicate label above input)
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

    // Full settings modal for existing teams
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
                                <li className={`ts-nav-item ${activeTab === "main" ? "active" : ""}`} onClick={() => setActiveTab("main")}>Основные</li>
                                <li className={`ts-nav-item ${activeTab === "members" ? "active" : ""}`} onClick={() => setActiveTab("members")}>Участники</li>
                                <li className={`ts-nav-item ${activeTab === "perms" ? "active" : ""}`} onClick={() => setActiveTab("perms")}>Разрешения</li>
                                <li className={`ts-nav-item ${activeTab === "invites" ? "active" : ""}`} onClick={() => setActiveTab("invites")}>Приглашения</li>
                                <li className={`ts-nav-item ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>Аудит логи</li>
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
                                        />
                                    </div>

                                    <hr className="ts-divider" />

                                    {/* Покинуть: visible to non-owners (admins + members) */}
                                    {!isOwner && (
                                        <div className="ts-section">
                                            <h4 className="ts-section-title">Покинуть команду</h4>
                                            <p className="ts-section-text">Покинув команду, вы потеряете доступ ко всем её доскам в своём аккаунте. При необходимости администратор сможет пригласить вас снова.</p>
                                            <div style={{ marginTop: 12 }}>
                                                <button className="btn-outlined-danger" onClick={() => setShowLeaveConfirm(true)}>Покинуть команду</button>
                                            </div>
                                        </div>
                                    )}

                                    {!isOwner && <hr className="ts-divider" />}

                                    {/* Удалить: visible only to owner */}
                                    {isOwner && (
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
                                            {(isAdminOrOwner || isCreate) && (
                                                <button type="button" className="primary-btn" onClick={handleSave} disabled={isEmpty} aria-disabled={isEmpty}>
                                                    {isCreate ? "Создать команду" : "Сохранить"}
                                                </button>
                                            )}
                                            <button type="button" className="secondary-btn" onClick={() => onClose && onClose()}>Отмена</button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === "members" && <div className="ts-placeholder">Список участников (заглушка)</div>}
                            {activeTab === "perms" && <div className="ts-placeholder">Управление разрешениями (заглушка)</div>}
                            {activeTab === "invites" && <div className="ts-placeholder">Приглашения (заглушка)</div>}
                            {activeTab === "audit" && <div className="ts-placeholder">Аудит логи (заглушка)</div>}
                        </section>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                compact={true}
                title="Удалить команду?"
                message={<p style={{ margin: 0 }}>Удаление команды приведёт к удалению всех её досок и потере доступа у участников. Это действие нельзя отменить.</p>}
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