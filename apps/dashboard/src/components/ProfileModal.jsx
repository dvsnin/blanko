import React, { useState, useEffect } from "react";
import "./Boards.modals.css";

/*
  ProfileModal — simplified:
  - оставлены поля для редактирования имени и просмотра email
  - полностью удалён блок "Команды, в которых вы состоите"
  - кнопка "Сохранить" вызывает onSave с новым именем
  - onClose закрывает модалку
*/

export default function ProfileModal({ name = "", email = "", onClose, onSave }) {
    const [editedName, setEditedName] = useState(name || "");

    useEffect(() => {
        setEditedName(name || "");
    }, [name]);

    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose && onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function handleSave() {
        if (typeof onSave === "function") onSave(editedName.trim());
        if (typeof onClose === "function") onClose();
    }

    return (
        <div
            className="boards-modal-backdrop"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose && onClose();
            }}
        >
            <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Настройки профиля">
                <div className="boards-modal-header">
                    <h2 className="boards-modal-title">Настройки профиля</h2>
                    <button
                        type="button"
                        className="boards-modal-close"
                        aria-label="Закрыть"
                        onClick={() => onClose && onClose()}
                    >
                        ×
                    </button>
                </div>

                <div className="boards-modal-body">
                    <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>Имя пользователя</div>
                    <input
                        className="boards-modal-input"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Ваше имя"
                    />

                    <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: "#374151" }}>Email</div>
                    <input
                        className="boards-modal-input input-disabled"
                        value={email || ""}
                        readOnly
                    />

                    {/* Removed teams list — intentionally left out to avoid duplication */}
                </div>

                <div className="boards-modal-footer">
                    <button type="button" className="primary-btn" onClick={handleSave}>Сохранить</button>
                    <button type="button" className="secondary-btn" onClick={() => onClose && onClose()}>Отмена</button>
                </div>
            </div>
        </div>
    );
}