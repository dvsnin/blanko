import { useEffect } from "react";

/**
 * Calls `callback` when the Escape key is pressed.
 * Only active when `enabled` is true (default).
 */
export function useEscapeKey(callback: (() => void) | undefined, enabled = true) {
  useEffect(() => {
    if (!enabled || !callback) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        callback!();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callback, enabled]);
}
