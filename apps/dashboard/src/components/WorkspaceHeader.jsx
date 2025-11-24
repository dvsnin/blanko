import React, { useState, useEffect } from "react";
import "./WorkspaceHeader.css";
import WorkspaceModal from "./WorkspaceModal";

/*
 Compact WorkspaceHeader — final adjustments:
 - removed chevron
 - the whole left area is a visible "button" with subtle background and border so it's clear it's interactive
 - reduced avatar size to 36px so more text fits
 - gentler truncation and larger max-width for title so longer names fit
 - vertically centered to match topbar icons
*/
export default function WorkspaceHeader() {
    const [workspaceName, setWorkspaceName] = useState("Workspace");
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const dash = typeof window !== "undefined" ? window.dashData || {} : {};
        const w = (dash.workspaceName && String(dash.workspaceName).trim()) || (dash.name && String(dash.name).trim()) || "Workspace";
        setWorkspaceName(w);
    }, []);

    const initials = (workspaceName || "W")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0].toUpperCase())
        .join("")
        .slice(0, 2);

    function shortName(name) {
        if (!name) return "Workspace";
        if (name.length <= 40) return name;
        const parts = name.split(" ").filter(Boolean);
        if (parts.length >= 2) {
            const candidate = `${parts[0]} ${parts[parts.length - 1]}`;
            if (candidate.length <= 40) return candidate;
        }
        return name.slice(0, 37).trim() + "…";
    }

    const display = shortName(workspaceName);

    return (
        <>
            <div className="workspace-header" role="region" aria-label="Workspace">
                <div
                    className="workspace-left"
                    onClick={() => setOpen(true)}
                    tabIndex={0}
                    role="button"
                    aria-expanded={open}
                    aria-label={`Открыть переключатель рабочих пространств (${workspaceName})`}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpen(true);
                        }
                    }}
                    title={workspaceName}
                >
                    <div className="workspace-avatar" aria-hidden>
                        {initials}
                    </div>

                    <div className="workspace-meta">
                        <div className="workspace-title">{display}</div>
                    </div>
                </div>
            </div>

            {open && <WorkspaceModal onClose={() => setOpen(false)} workspaceName={workspaceName} />}
        </>
    );
}