import React from "react";
import ConfirmModal from "./ConfirmModal";

/*
  BoardDeleteModal — deletion wrapper that uses ConfirmModal.
  Kept simple so layout/visuals controlled by ConfirmModal and CSS.
*/
export default function BoardDeleteModal({ board = {}, isOpen = false, onCancel, onDelete }) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            compact={true}
            title="Удалить доску?"
            message={<span>Это приведёт к удалению <strong>{board?.name}</strong> и всех связанных данных. Это действие необратимо.</span>}
            confirmLabel="Удалить"
            cancelLabel="Отмена"
            danger={true}
            onConfirm={() => {
                if (typeof onDelete === "function") onDelete(board?.id);
            }}
            onCancel={onCancel}
        />
    );
}