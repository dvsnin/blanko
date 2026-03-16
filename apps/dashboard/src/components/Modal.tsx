import React, { useCallback, useRef, type ReactNode } from "react";
import { useEscapeKey } from "../hooks/useEscapeKey";
import "./Boards.modals.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Additional class name on .boards-modal */
  className?: string;
  /** aria-label override (defaults to title) */
  ariaLabel?: string;
}

/**
 * Reusable modal component with:
 * - Backdrop click to close
 * - Escape key to close
 * - Consistent header with close button
 * - Propagation stop on inner container
 */
export function Modal({ isOpen, onClose, title, children, className, ariaLabel }: ModalProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, isOpen);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  const cls = ["boards-modal", className].filter(Boolean).join(" ");

  return (
    <div className="boards-modal-backdrop" onMouseDown={handleBackdrop}>
      <div
        ref={innerRef}
        className={cls}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="boards-modal-header">
          <h3 className="boards-modal-title">{title}</h3>
          <button
            type="button"
            className="boards-modal-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* Sub-components for consistent layout */

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={`boards-modal-body ${className || ""}`}>{children}</div>;
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ModalFooter({ children, className, style }: ModalFooterProps) {
  return (
    <div className={`boards-modal-footer ${className || ""}`} style={style}>
      {children}
    </div>
  );
}
