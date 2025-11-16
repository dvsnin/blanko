import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/*
MenuPortal
- anchorRef: ref to the element which the menu should be positioned relative to
- isOpen: boolean
- placement: "bottom" | "top"
- shiftLeft: boolean (if true, prefer aligning to anchor.left / avoid overflow)
- children: the menu element (the menu should be rendered as normal flow element inside the host)
*/
export default function MenuPortal({
                                       anchorRef,
                                       isOpen,
                                       placement = "bottom",
                                       shiftLeft = false,
                                       children,
                                   }) {
    const hostRef = useRef(null);
    const rafRef = useRef(null);

    if (!hostRef.current) {
        hostRef.current = document.createElement("div");
        hostRef.current.className = "portal-container";
        // host is positioned absolutely; MenuPortal will set left/top coordinates
        hostRef.current.style.position = "absolute";
        hostRef.current.style.left = "0px";
        hostRef.current.style.top = "0px";
        hostRef.current.style.pointerEvents = "none"; // allow interactions only when positioned
        hostRef.current.style.zIndex = "9999";
    }

    useEffect(() => {
        document.body.appendChild(hostRef.current);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (hostRef.current && hostRef.current.parentNode) {
                hostRef.current.parentNode.removeChild(hostRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            // hide pointer interactions when closed
            hostRef.current.style.pointerEvents = "none";
            return;
        }

        function updatePosition() {
            if (!anchorRef?.current) return;
            const anchorRect = anchorRef.current.getBoundingClientRect();
            const host = hostRef.current;
            const menuEl = host.firstElementChild;
            if (!menuEl) {
                // menu not mounted yet, try again on next frame
                rafRef.current = requestAnimationFrame(updatePosition);
                return;
            }

            // measure menu as rendered (menu should be normal/static/relative inside host)
            const menuRect = menuEl.getBoundingClientRect();
            const margin = 8;

            // compute left: by default align right edges (anchor.right -> menu.right)
            let left = anchorRect.right - menuRect.width;
            // keep inside viewport
            left = Math.min(left, window.innerWidth - menuRect.width - margin);
            left = Math.max(left, margin);

            if (shiftLeft) {
                // prefer aligning to the anchor's left edge
                left = Math.max(margin, anchorRect.left);
                left = Math.min(left, window.innerWidth - menuRect.width - margin);
            }

            // compute top depending on placement
            let top;
            if (placement === "bottom") {
                top = anchorRect.bottom + 8;
                // if overflow bottom - flip to top
                if (top + menuRect.height > window.innerHeight - margin) {
                    top = anchorRect.top - menuRect.height - 8;
                }
            } else {
                top = anchorRect.top - menuRect.height - 8;
                if (top < margin) {
                    top = anchorRect.bottom + 8;
                }
            }

            host.style.left = `${Math.round(left)}px`;
            host.style.top = `${Math.round(top)}px`;

            // enable pointer events for menu now that it's positioned
            host.style.pointerEvents = "auto";
        }

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isOpen, anchorRef, placement, shiftLeft]);

    if (!isOpen) return null;
    return createPortal(children, hostRef.current);
}