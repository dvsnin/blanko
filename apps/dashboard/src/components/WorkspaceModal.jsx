import React, { useEffect } from "react";
import "./Boards.modals.css";

/**
 * Workspace modal — текст на русском (placeholder)
 */
export default function WorkspaceModal({ onClose, workspaceName }) {
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose && onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="boards-modal-backdrop"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose && onClose();
            }}
        >
            <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Переключатель рабочих пространств">
                <div className="boards-modal-header">
                    <h3 className="boards-modal-title">Рабочее пространство</h3>
                    <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={() => onClose && onClose()}>
                        ×
                    </button>
                </div>

                <div className="boards-modal-body">
                    <p style={{ color: "#374151", marginTop: 0 }}>
                        Выбрано рабочее пространство: <strong>{workspaceName}</strong>
                    </p>

                    <p style={{ color: "#556070" }}>
                        Здесь позже будет список рабочих пространств и переключатель. Сейчас это заглушка — нажмите «Закрыть», чтобы вернуться.
                    </p>
                </div>

                <div className="boards-modal-footer">
                    <button type="button" className="primary-btn" onClick={() => onClose && onClose()}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}