import { Modal, ModalBody, ModalFooter } from "./Modal";

interface WorkspaceModalProps {
  onClose: () => void;
  workspaceName: string;
}

/**
 * Workspace modal — placeholder for workspace switcher.
 */
export default function WorkspaceModal({ onClose, workspaceName }: WorkspaceModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Рабочее пространство" ariaLabel="Переключатель рабочих пространств">
      <ModalBody>
        <p style={{ color: "#374151", marginTop: 0 }}>
          Выбрано рабочее пространство: <strong>{workspaceName}</strong>
        </p>

        <p style={{ color: "#556070" }}>
          Здесь позже будет список рабочих пространств и переключатель. Сейчас это заглушка — нажмите «Закрыть», чтобы вернуться.
        </p>
      </ModalBody>

      <ModalFooter>
        <button type="button" className="primary-btn" onClick={onClose}>
          Закрыть
        </button>
      </ModalFooter>
    </Modal>
  );
}
