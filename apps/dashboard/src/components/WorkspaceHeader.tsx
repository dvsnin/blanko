import { useState } from "react";
import "./WorkspaceHeader.css";
import WorkspaceModal from "./WorkspaceModal";
import { useUser } from "../contexts/UserContext";

/*
  WorkspaceHeader — compact header showing workspace name.
  Now reads workspace info from UserContext instead of window.dashData directly.
*/
export default function WorkspaceHeader() {
  const { workspaceName } = useUser();
  const [open, setOpen] = useState(false);

  const initials = (workspaceName || "W")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("")
    .slice(0, 2);

  function shortName(name: string) {
    if (!name) return "Рабочее пространство";
    if (name.length <= 40) return name;
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      const candidate = `${parts[0]} ${parts[parts.length - 1]}`;
      if (candidate.length <= 40) return candidate;
    }
    return name.slice(0, 37).trim() + "\u2026";
  }

  const display = shortName(workspaceName);

  return (
    <>
      <div className="workspace-header" role="region" aria-label="Рабочее пространство">
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
