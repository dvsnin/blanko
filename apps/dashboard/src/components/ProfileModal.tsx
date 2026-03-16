import { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "./Modal";

interface ProfileModalProps {
  name?: string;
  email?: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export default function ProfileModal({ name = "", email = "", onClose, onSave }: ProfileModalProps) {
  const [editedName, setEditedName] = useState(name);

  useEffect(() => {
    setEditedName(name || "");
  }, [name]);

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

        <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: "#374151" }}>Email</div>
        <input className="boards-modal-input input-disabled" value={email || ""} readOnly />
      </ModalBody>

      <ModalFooter>
        <button type="button" className="primary-btn" onClick={handleSave}>Сохранить</button>
        <button type="button" className="secondary-btn" onClick={onClose}>Отмена</button>
      </ModalFooter>
    </Modal>
  );
}
