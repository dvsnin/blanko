import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/* Портал для меню карточек: позиционируется от anchorRef, закрывается, когда курсор ушёл и с кнопки, и с меню. */

export interface MenuPortalProps {
    anchorRef: RefObject<HTMLElement | null>;
    isOpen: boolean;
    placement?: string;
    children: ReactNode;
    onClose?: () => void;
}

function createHost(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "portal-container";
    host.style.position = "fixed";
    host.style.left = "0px";
    host.style.top = "0px";
    host.style.pointerEvents = "none";
    host.style.visibility = "hidden";
    host.style.zIndex = "2147483000";
    return host;
}

export default function MenuPortal({ anchorRef, isOpen, placement = "bottom", children, onClose }: MenuPortalProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    if (typeof document !== "undefined" && !hostRef.current) {
        hostRef.current = createHost();
    }

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        document.body.appendChild(host);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
            host.parentNode?.removeChild(host);
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
        host.style.visibility = "hidden";

        function updatePosition() {
            if (!host) return;
            const anchor = anchorRef.current;
            const wrapper = host.firstElementChild;
            const menuEl = wrapper?.firstElementChild ?? wrapper;
            if (!anchor || !menuEl) {
                rafRef.current = requestAnimationFrame(updatePosition);
                return;
            }

            const anchorRect = anchor.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Слева от кнопки, по центру; не влезает - справа; иначе сверху или снизу
            let left = Math.round(anchorRect.left - menuRect.width - margin);
            let top = Math.round(anchorRect.top + anchorRect.height / 2 - menuRect.height / 2);
            let resolvedPlacement = "left";

            if (left < margin) {
                const rightLeft = Math.round(anchorRect.right + margin);
                if (rightLeft + menuRect.width <= vw - margin) {
                    left = rightLeft;
                    resolvedPlacement = "right";
                } else {
                    const topCandidate = Math.round(anchorRect.top - menuRect.height - margin);
                    const bottomCandidate = Math.round(anchorRect.bottom + margin);
                    left = Math.round(anchorRect.left + anchorRect.width / 2 - menuRect.width / 2);
                    if (topCandidate >= margin) {
                        top = topCandidate;
                        resolvedPlacement = "top";
                    } else {
                        top = bottomCandidate;
                        resolvedPlacement = "bottom";
                    }
                }
            }

            const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
            left = clamp(left, margin, Math.max(margin, vw - menuRect.width - margin));
            top = clamp(top, margin, Math.max(margin, vh - menuRect.height - margin));

            host.style.left = `${left}px`;
            host.style.top = `${top}px`;
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

        function clearLeaveTimer() {
            if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
            }
        }
        function tryScheduleClose() {
            clearLeaveTimer();
            if (!anchorHovered && !hostHovered) {
                leaveTimerRef.current = setTimeout(() => {
                    if (!anchorHovered && !hostHovered) onClose?.();
                }, 180);
            }
        }
        const onAnchorEnter = () => { anchorHovered = true; clearLeaveTimer(); };
        const onAnchorLeave = () => { anchorHovered = false; tryScheduleClose(); };
        const onHostEnter = () => { hostHovered = true; clearLeaveTimer(); };
        const onHostLeave = () => { hostHovered = false; tryScheduleClose(); };

        const anchorEl = anchorRef.current;
        anchorEl?.addEventListener("mouseenter", onAnchorEnter);
        anchorEl?.addEventListener("mouseleave", onAnchorLeave);
        host.addEventListener("mouseenter", onHostEnter);
        host.addEventListener("mouseleave", onHostLeave);

        return () => {
            window.removeEventListener("resize", onUpdate);
            window.removeEventListener("scroll", onUpdate, true);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            clearLeaveTimer();
            anchorEl?.removeEventListener("mouseenter", onAnchorEnter);
            anchorEl?.removeEventListener("mouseleave", onAnchorLeave);
            host.removeEventListener("mouseenter", onHostEnter);
            host.removeEventListener("mouseleave", onHostLeave);
        };
    }, [isOpen, anchorRef, placement, onClose]);

    if (!isOpen || !hostRef.current) return null;

    return createPortal(
        <div className="portal-wrapper" style={{ pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
            {children}
        </div>,
        hostRef.current,
    );
}
