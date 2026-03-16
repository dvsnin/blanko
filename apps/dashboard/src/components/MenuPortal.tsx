import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function MenuPortal({
                                       anchorRef,
                                       isOpen,
                                       placement = "bottom",
                                       shiftLeft = false,
                                       children,
                                       onClose, // new
                                   }) {
    const hostRef = useRef(null);
    const rafRef = useRef(null);
    const leaveTimerRef = useRef(null);

    if (typeof document !== "undefined" && !hostRef.current) {
        hostRef.current = document.createElement("div");
        hostRef.current.className = "portal-container";
        hostRef.current.style.position = "fixed";
        hostRef.current.style.left = "0px";
        hostRef.current.style.top = "0px";
        hostRef.current.style.pointerEvents = "none";
        hostRef.current.style.visibility = "hidden";
        hostRef.current.style.zIndex = "2147483000";
    }

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        document.body.appendChild(host);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
            if (host && host.parentNode) host.parentNode.removeChild(host);
        };
    }, []);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        if (!isOpen) {
            host.style.pointerEvents = "none";
            host.style.visibility = "hidden";
            host.removeAttribute("data-placement");
            return;
        }

        host.style.pointerEvents = "auto";
        host.style.visibility = "hidden"; // keep hidden until positioned

        function updatePosition() {
            const anchor = anchorRef?.current;
            const wrapper = host.firstElementChild; // portal wrapper
            const menuEl = wrapper?.firstElementChild || wrapper; // menu may be direct child
            if (!anchor || !menuEl) {
                rafRef.current = requestAnimationFrame(updatePosition);
                return;
            }

            const anchorRect = anchor.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Preferred: left of anchor, vertically centered
            let left = Math.round(anchorRect.left - menuRect.width - margin);
            let top = Math.round(anchorRect.top + (anchorRect.height / 2) - (menuRect.height / 2));
            let resolvedPlacement = "left";

            // If left doesn't fit, try right
            if (left < margin) {
                const rightLeft = Math.round(anchorRect.right + margin);
                if (rightLeft + menuRect.width <= vw - margin) {
                    left = rightLeft;
                    resolvedPlacement = "right";
                } else {
                    // fallback to top / bottom: prefer top if enough space else bottom
                    const topCandidate = Math.round(anchorRect.top - menuRect.height - margin);
                    const bottomCandidate = Math.round(anchorRect.bottom + margin);
                    if (topCandidate >= margin) {
                        top = topCandidate;
                        left = Math.round(anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2));
                        resolvedPlacement = "top";
                    } else {
                        top = bottomCandidate;
                        left = Math.round(anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2));
                        resolvedPlacement = "bottom";
                    }
                }
            }

            // clamp so the menu never overflows viewport
            const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
            left = clamp(left, margin, Math.max(margin, vw - menuRect.width - margin));
            top = clamp(top, margin, Math.max(margin, vh - menuRect.height - margin));

            host.style.left = `${Math.round(left)}px`;
            host.style.top = `${Math.round(top)}px`;
            host.style.visibility = "visible";
            host.style.pointerEvents = "auto";

            host.setAttribute("data-placement", resolvedPlacement);
        }

        updatePosition();
        const onUpdate = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(updatePosition);
        };
        window.addEventListener("resize", onUpdate);
        window.addEventListener("scroll", onUpdate, true);

        let anchorHovered = false;
        let hostHovered = false;

        function tryScheduleClose() {
            if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
            }
            // if neither hovered, schedule close
            if (!anchorHovered && !hostHovered) {
                leaveTimerRef.current = setTimeout(() => {
                    // if still not hovered, request close
                    if (!anchorHovered && !hostHovered) {
                        if (typeof onClose === "function") onClose();
                    }
                }, 180); // short delay to allow small pointer moves
            }
        }

        function onAnchorEnter() {
            anchorHovered = true;
            if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
        }
        function onAnchorLeave() {
            anchorHovered = false;
            tryScheduleClose();
        }

        function onHostEnter() {
            hostHovered = true;
            if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
        }
        function onHostLeave() {
            hostHovered = false;
            tryScheduleClose();
        }

        const anchorEl = anchorRef?.current;
        if (anchorEl) {
            anchorEl.addEventListener("mouseenter", onAnchorEnter);
            anchorEl.addEventListener("mouseleave", onAnchorLeave);
        }
        host.addEventListener("mouseenter", onHostEnter);
        host.addEventListener("mouseleave", onHostLeave);

        return () => {
            window.removeEventListener("resize", onUpdate);
            window.removeEventListener("scroll", onUpdate, true);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
            if (anchorEl) {
                anchorEl.removeEventListener("mouseenter", onAnchorEnter);
                anchorEl.removeEventListener("mouseleave", onAnchorLeave);
            }
            host.removeEventListener("mouseenter", onHostEnter);
            host.removeEventListener("mouseleave", onHostLeave);
        };
    }, [isOpen, anchorRef, placement, shiftLeft, onClose]);

    if (!isOpen) return null;

    const wrapper = (
        <div
            className="portal-wrapper"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );

    return createPortal(wrapper, hostRef.current);
}