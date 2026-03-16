import { useState, useLayoutEffect, type RefObject } from "react";

export type MenuPlacement = "left" | "right" | "top" | "bottom";

interface MenuPositionResult {
  style: React.CSSProperties | null;
  placement: MenuPlacement;
}

/**
 * Computes fixed-position style for a menu anchored to a trigger element.
 * Tries left placement first, then right, top, bottom — with viewport clamping.
 */
export function useMenuPosition(
  anchorRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
): MenuPositionResult {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const [placement, setPlacement] = useState<MenuPlacement>("left");

  useLayoutEffect(() => {
    if (!isOpen) {
      setStyle(null);
      return;
    }

    let raf = 0;
    const margin = 8;

    function update() {
      const anchor = anchorRef.current;
      const menuEl = menuRef.current;
      if (!anchor || !menuEl) {
        raf = requestAnimationFrame(update);
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = Math.round(anchorRect.left - menuRect.width - margin);
      let top = Math.round(anchorRect.top + anchorRect.height / 2 - menuRect.height / 2);
      let resolvedPlacement: MenuPlacement = "left";

      if (left < margin) {
        const rightLeft = Math.round(anchorRect.right + margin);
        if (rightLeft + menuRect.width <= vw - margin) {
          left = rightLeft;
          resolvedPlacement = "right";
        } else {
          const topCandidate = Math.round(anchorRect.top - menuRect.height - margin);
          const bottomCandidate = Math.round(anchorRect.bottom + margin);
          if (topCandidate >= margin) {
            top = topCandidate;
            left = Math.round(anchorRect.left + anchorRect.width / 2 - menuRect.width / 2);
            resolvedPlacement = "top";
          } else {
            top = bottomCandidate;
            left = Math.round(anchorRect.left + anchorRect.width / 2 - menuRect.width / 2);
            resolvedPlacement = "bottom";
          }
        }
      }

      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      left = clamp(left, margin, Math.max(margin, vw - menuRect.width - margin));
      top = clamp(top, margin, Math.max(margin, vh - menuRect.height - margin));

      setPlacement(resolvedPlacement);
      setStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 2147483000,
      });
    }

    raf = requestAnimationFrame(update);

    function onResize() {
      requestAnimationFrame(update);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, anchorRef, menuRef]);

  return { style, placement };
}
