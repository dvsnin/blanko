import { useEffect } from "react";

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
