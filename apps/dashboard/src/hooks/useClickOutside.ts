import { useEffect, type RefObject } from "react";

/**
 * Calls `callback` when a click occurs outside all provided refs.
 * Only active when `enabled` is true (default).
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  callback: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const isInside = refs.some((ref) => {
        const el = ref.current;
        if (!el) return false;
        return el.contains(target);
      });

      if (!isInside) {
        callback();
      }
    }

    // Use mousedown to catch clicks before they propagate
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [refs, callback, enabled]);
}
