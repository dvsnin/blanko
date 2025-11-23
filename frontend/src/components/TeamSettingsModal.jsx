import React, { useEffect, useRef, useState } from "react";
import "./TeamsPanel.css";

/*
  TeamSettingsModal — role-aware modal:
  - If creating: editable name + Create.
  - If editing as owner or admin: editable name, Save, and Delete (owner/admin can delete).
  - If editing as member (not admin/owner): read-only name and Leave button.
  - Owner cannot see Leave (can't leave) — only delete. Admin can both leave and delete (per request admin can delete).
*/

export default function TeamSettingsModal({ team, onClose, onSave, onDelete, onLeave }) {
    const [name, setName] = useState(team?.name || "");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        setName(team?.name || "");
        setShowDeleteConfirm(false);
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

    const isCreate = !team?.id;
    const isOwner = team?.role === "owner";
    const isAdmin = team?.role === "admin" || isOwner;

    function handleSave() {
        const trimmed = (name || "").trim();
        if (!trimmed) return;
        onSave && onSave(team.id, trimmed);
        onClose && onClose();
    }

    function handleDeleteConfirmed() {
        if (!team?.id) return;
        onDelete && onDelete(team.id);
        onClose && onClose();
    }

    function handleLeave() {
        if (!team?.id) return;
        if (onLeave) onLeave(team.id);
        onClose && onClose();
    }

    return (
        <div className="teams-modal-backdrop" onMouseDown={handleBackdrop}>
            <div className="teams-modal" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
                <h3 className="teams-modal-title">{isCreate ? "Новая команда" : "Настройки команды"}</h3>

                <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 8 }}>Название команды</label>

                {isAdmin || isCreate ? (
                    <input
                        className="teams-modal-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Название команды"
                        autoFocus
                    />
                ) : (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #eef2f7", background: "#fbfdff" }}>{name}</div>
                    </div>
                )}

                {!isAdmin && !isCreate && (
                    <p className="teams-modal-note">Вы не можете изменять настройки команды — у вас нет прав администратора.</p>
                )}

                {isAdmin && !isCreate && !showDeleteConfirm && (
                    <>
                        <hr style={{ border: "none", borderTop: "1px solid #eef2f7", margin: "18px 0" }} />
                        <div style={{ color: "#6b7280", marginBottom: 12 }}>Удаление команды приведет к удалению всех её досок и потере данных участников.</div>
                        <div style={{ marginBottom: 8 }}>
                            <button className="danger-btn" onClick={() => setShowDeleteConfirm(true)}>Удалить команду</button>
                        </div>
                    </>
                )}

                {showDeleteConfirm && (
                    <div style={{ marginTop: 6 }}>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Удалить команду?</h3>
                        <p style={{ color: "#6b7280", marginTop: 0 }}>
                            Это приведёт к удалению команды <strong>{team.name}</strong> и всех её досок.
                        </p>

                        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
                            <button
                                className="danger-btn"
                                onClick={handleDeleteConfirmed}
                                style={{ background: "#fff5f6", border: "1px solid rgba(191,30,46,0.12)", color: "#bf1e2e" }}
                            >
                                Удалить
                            </button>
                            <button className="teams-cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Отмена</button>
                        </div>
                    </div>
                )}

                {/* Non-owner leave action */}
                {!isAdmin && !isCreate && (
                    <div style={{ marginTop: 16 }}>
                        <button className="danger-btn" onClick={() => { if (confirm("Покинуть команду?")) handleLeave(); }}>
                            Покинуть команду
                        </button>
                    </div>
                )}

                {/* Admins who are not owners AND admins who are owners: show leave option for admins (admin can leave) but owner cannot */}
                {isAdmin && !isOwner && !showDeleteConfirm && (
                    <div style={{ marginTop: 12 }}>
                        <button className="danger-btn" onClick={() => { if (confirm("Покинуть команду?")) handleLeave(); }}>
                            Покинуть команду
                        </button>
                    </div>
                )}

                {/* Footer actions */}
                <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                    {(isAdmin || isCreate) && <button className="teams-primary-btn" onClick={handleSave}>{isCreate ? "Создать команду" : "Сохранить"}</button>}
                    <button className="teams-cancel-btn" onClick={() => onClose && onClose()}>Отмена</button>
                </div>
            </div>
        </div>
    );
}