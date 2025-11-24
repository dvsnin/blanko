import React, { useEffect, useRef, useState } from "react";
import "./TeamsPanel.css";
import "./Boards.modals.css";

/*
 TeamSettingsModal — now 1:1 behaviour with "rename board" modal:
 - Uses the same modal structure (.boards-modal-header / .boards-modal-body / .boards-modal-footer)
 - Input gets .boards-modal-input--empty whenever the value is empty (so red tint is shown immediately)
 - Primary button is disabled when input is empty (same as rename modal)
 - Backdrop closing uses onMouseDown check (e.target === e.currentTarget) to avoid accidental close during selection/drags
 - Close button matches other modals
*/

export default function TeamSettingsModal({ team = {}, onClose, onSave, onDelete, onLeave }) {
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

    const isCreate = !!team?.create || !team?.id;
    const isOwner = team?.role === "owner";
    const isAdmin = team?.role === "admin" || isOwner;
    const isEmpty = (name || "").trim() === "";

    function handleSave() {
        const trimmed = (name || "").trim();
        if (!trimmed) return; // button is disabled when empty, but keep guard
        if (typeof onSave === "function") onSave(team?.id, trimmed);
        if (typeof onClose === "function") onClose();
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
        <div className="boards-modal-backdrop" onMouseDown={handleBackdrop}>
            <div className="boards-modal" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
                <div className="boards-modal-header">
                    <h3 className="boards-modal-title">{isCreate ? "Новая команда" : "Настройки команды"}</h3>
                    <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={() => onClose && onClose()}>
                        ×
                    </button>
                </div>

                <div className="boards-modal-body">
                    {isAdmin || isCreate ? (
                        <input
                            className={`boards-modal-input ${isEmpty ? "boards-modal-input--empty" : ""}`}
                            value={name}
                            autoFocus
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave();
                                if (e.key === "Escape") onClose && onClose();
                            }}
                            aria-label={isCreate ? "Название новой команды" : "Название команды для редактирования"}
                            aria-invalid={isEmpty}
                            placeholder="Название команды"
                        />
                    ) : (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #eef2f7", background: "#fbfdff" }}>{name}</div>
                        </div>
                    )}
                </div>

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
                            <button className="danger-btn" onClick={handleDeleteConfirmed} style={{ background: "#fff5f6", border: "1px solid rgba(191,30,46,0.12)", color: "#bf1e2e" }}>
                                Удалить
                            </button>
                            <button className="secondary-btn" onClick={() => setShowDeleteConfirm(false)}>Отмена</button>
                        </div>
                    </div>
                )}

                {!isAdmin && !isCreate && (
                    <div style={{ marginTop: 16 }}>
                        <button className="danger-btn" onClick={() => { if (confirm("Покинуть команду?")) handleLeave(); }}>
                            Покинуть команду
                        </button>
                    </div>
                )}

                {isAdmin && !isOwner && !showDeleteConfirm && (
                    <div style={{ marginTop: 12 }}>
                        <button className="danger-btn" onClick={() => { if (confirm("Покинуть команду?")) handleLeave(); }}>
                            Покинуть команду
                        </button>
                    </div>
                )}

                <div className="boards-modal-footer">
                    {(isAdmin || isCreate) && (
                        <button type="button" className="primary-btn" onClick={handleSave} disabled={isEmpty} aria-disabled={isEmpty}>
                            {isCreate ? "Создать команду" : "Сохранить"}
                        </button>
                    )}
                    <button type="button" className="secondary-btn" onClick={() => onClose && onClose()}>Отмена</button>
                </div>
            </div>
        </div>
    );
}