import { useState, useRef, useCallback } from "react";

interface ToastState {
  message: string;
  visible: boolean;
}

/**
 * Manages a toast notification with auto-dismiss.
 */
export function useToast(duration = 1800) {
  const [state, setState] = useState<ToastState>({ message: "", visible: false });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setState({ message, visible: true });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, visible: false }));
      }, duration);
    },
    [duration],
  );

  return {
    toastMessage: state.message,
    toastVisible: state.visible,
    showToast,
  };
}
