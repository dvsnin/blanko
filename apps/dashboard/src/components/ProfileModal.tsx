import { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "./Modal";
import { api } from "../api/client";

interface ProfileModalProps {
  /** Начальные значения (из UserContext) — показываются сразу, пока грузится /account/get. */
  name?: string;
  email?: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

/**
 * ProfileModal — редактор профиля. При открытии дергает POST /account/get,
 * чтобы получить актуальные данные из БД (window.dashData может быть устаревшим,
 * если имя меняли в другой вкладке). До ответа показываем то, что пришло в props.
 */
export default function ProfileModal({ name = "", email = "", onClose, onSave }: ProfileModalProps) {
  const [editedName, setEditedName] = useState(name);
  const [currentEmail, setCurrentEmail] = useState(email);

  useEffect(() => {
    let cancelled = false;
    void api.account
      .get()
      .then((acc) => {
        if (cancelled) return;
        setEditedName(acc.name || "");
        setCurrentEmail(acc.email || "");
      })
      .catch((e) => {
        console.warn("account.get failed:", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSave() {
    onSave?.(editedName.trim());
    onClose?.();
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Настройки профиля">
      <ModalBody>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>Имя пользователя</div>
        <input
          className="boards-modal-input"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          placeholder="Ваше имя"
        />

        <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: "#374151" }}>Электронная почта</div>
        <input className="boards-modal-input input-disabled" value={currentEmail || ""} readOnly />
      </ModalBody>

      <ModalFooter>
        <button type="button" className="primary-btn" onClick={handleSave}>Сохранить</button>
        <button type="button" className="secondary-btn" onClick={onClose}>Отмена</button>
      </ModalFooter>
    </Modal>
  );
}
