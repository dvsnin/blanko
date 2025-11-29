import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Boards.modals.css";

/*
  ConfirmModal — portal-based confirm dialog.
  - Single #confirm-portal-root appended to body (pointer-events: none by default).
  - Portal child uses pointer-events:auto while mounted so it captures clicks.
  - compact: smaller dialog variant
  - danger: when true the confirm button uses red .danger-btn
*/

function ensurePortalRoot() {
    if (typeof document === "undefined") return null;
    let root = document.getElementById("confirm-portal-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "confirm-portal-root";
        root.style.position = "fixed";
        root.style.inset = "0";
        root.style.zIndex = "2147483000";
        root.style.pointerEvents = "none"; // don't block clicks when empty
        document.body.appendChild(root);
    }
    return root;
}

export default function ConfirmModal({
                                         isOpen,
                                         compact = false,
                                         title = "Подтвердите действие",
                                         message = null,
                                         confirmLabel = "OK",
                                         cancelLabel = "Отмена",
                                         onConfirm,
                                         onCancel,
                                         danger = false,
                                     }) {
    useEffect(() => {
        if (!isOpen) return;
        function onKey(e) {
            if (e.key === "Escape") onCancel && onCancel();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const root = ensurePortalRoot();
    if (!root) return null;

    const cls = ["boards-modal", "boards-modal--confirm"];
    if (compact) cls.push("boards-modal--compact");

    const node = (
        <div className="confirm-portal-host-child" style={{ pointerEvents: "auto" }}>
            <div
                className="boards-modal-backdrop confirm-backdrop"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onCancel && onCancel();
                }}
            >
                <div className={cls.join(" ")} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="boards-modal-header">
                        <h3 className="boards-modal-title">{title}</h3>
                        <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={() => onCancel && onCancel()}>
                            ×
                        </button>
                    </div>

                    <div className="boards-modal-body">
                        <div style={{ color: "#374151", fontSize: 15, lineHeight: 1.55 }}>{message}</div>
                    </div>

                    <div className="boards-modal-footer confirm-footer" style={{ marginTop: 18 }}>
                        <button
                            type="button"
                            className={danger ? "danger-btn" : "primary-btn"}
                            onClick={() => {
                                if (typeof onConfirm === "function") onConfirm();
                            }}
                        >
                            {confirmLabel}
                        </button>

                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => {
                                if (typeof onCancel === "function") onCancel();
                            }}
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(node, root);
}