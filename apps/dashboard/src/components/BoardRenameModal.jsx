import React, { useEffect, useRef, useState } from "react";
import "./Boards.modals.css";

/*
  BoardRenameModal — rename board modal.
  - Shows error state (red border + glow) when input is empty
  - Footer buttons aligned to input / content left padding
*/
export default function BoardRenameModal({ board = {}, isOpen = true, onClose, onSave }) {
    const [name, setName] = useState(board?.name || "");
    const ref = useRef(null);

    useEffect(() => {
        setName(board?.name || "");
    }, [board]);

    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose && onClose();
            if (e.key === "Enter") {
                if ((name || "").trim()) {
                    onSave && onSave(board?.id, (name || "").trim());
                    onClose && onClose();
                }
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [name, onClose, onSave, board]);

    if (!isOpen) return null;

    const isEmpty = (name || "").trim() === "";

    return (
        <div className="boards-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
            <div className="boards-modal" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
                <div className="boards-modal-header">
                    <h3 className="boards-modal-title">Переименовать доску</h3>
                    <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={() => onClose && onClose()}>×</button>
                </div>

                <div className="boards-modal-body">
                    <input
                        className={`boards-modal-input ${isEmpty ? "boards-modal-input--empty" : ""}`}
                        value={name}
                        autoFocus
                        placeholder="Название доски"
                        onChange={(e) => setName(e.target.value)}
                        aria-label="Название доски"
                    />
                </div>

                <div className="boards-modal-footer">
                    <button
                        type="button"
                        className="primary-btn"
                        onClick={() => {
                            if (isEmpty) return;
                            onSave && onSave(board?.id, name.trim());
                            onClose && onClose();
                        }}
                        disabled={isEmpty}
                        aria-disabled={isEmpty}
                    >
                        Сохранить
                    </button>
                    <button type="button" className="secondary-btn" onClick={() => onClose && onClose()}>Отмена</button>
                </div>
            </div>
        </div>
    );
}