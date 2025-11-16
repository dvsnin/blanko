// ProfileModal.jsx
import { useState, useEffect } from "react";

export default function ProfileModal({ name, email, onClose, onSave }) {
    const [editedName, setEditedName] = useState(name);

    useEffect(() => {
        setEditedName(name);
    }, [name]);

    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    function handleSave() {
        onSave(editedName);
    }

    function handleOverlayClick(event) {
        if (event.target === event.currentTarget) {
            onClose();
        }
    }

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
                <div className="modal-header">
                    <h2>Настройки профиля</h2>
                    <button
                        type="button"
                        className="close-btn"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    <label>Имя пользователя</label>
                    <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                    />

                    <label>Email</label>
                    <input
                        type="text"
                        value={email}
                        readOnly
                        className="input-disabled"
                    />

                    <label>Команды, в которых вы состоите</label>

                    <div className="team-item">
                        <div className="team-role">owner</div>
                        <div className="team-name">Моя команда</div>
                        <div className="team-arrow">➜</div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="save-btn"
                        onClick={handleSave}
                    >
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
}
