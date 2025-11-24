import { useState, useEffect } from "react";
import "./Boards.modals.css";

/*
  ProfileModal — synchronized with app teams:
  - Modal layout updated to keep modal height fixed and make the teams area scrollable
  - Name is editable, email is readOnly and uses input-disabled class
  - Backdrop handled by the modal itself
  - Clicking a team calls onOpenTeam(teamId)
*/

export default function ProfileModal({ name, email, teams = [], activeTeamId, onOpenTeam, onClose, onSave }) {
    const [editedName, setEditedName] = useState(name || "");

    useEffect(() => {
        setEditedName(name || "");
    }, [name]);

    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") onClose && onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function handleSave() {
        onSave && onSave(editedName);
    }

    return (
        <div
            className="boards-modal-backdrop"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose && onClose();
            }}
        >
            <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="boards-modal-header">
                    <h2 className="boards-modal-title">Настройки профиля</h2>
                    <button
                        type="button"
                        className="boards-modal-close"
                        aria-label="Закрыть"
                        onClick={() => onClose && onClose()}
                    >
                        ×
                    </button>
                </div>

                <div className="boards-modal-body">
                    <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>Имя пользователя</div>
                    <input
                        className="boards-modal-input"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Ваше имя"
                    />

                    <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: "#374151" }}>Email</div>
                    <input
                        className="boards-modal-input input-disabled"
                        value={email || ""}
                        readOnly
                    />

                    <div style={{ marginTop: 18 }}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Команды, в которых вы состоите</div>

                        {/* Scrollable container for teams — fixed height via CSS */}
                        <div className="teams-list-scroll" role="list">
                            {teams.length === 0 && <div style={{ color: "#6b7280" }}>Вы ещё не состоите ни в одной команде</div>}

                            {teams.map((t) => {
                                const isActive = t.id === activeTeamId;
                                return (
                                    <div
                                        key={t.id}
                                        className="team-item"
                                        role="listitem"
                                        style={{
                                            border: isActive ? "1px solid rgba(79,139,255,0.18)" : "1px solid #eef0f3",
                                            borderRadius: 10,
                                            alignItems: "center",
                                            display: "flex",
                                            gap: 12,
                                            padding: "12px",
                                            background: isActive ? "linear-gradient(180deg,#fbfdff,#fff)" : "#fff",
                                        }}
                                    >
                                        <div style={{ width: 56, textAlign: "center", color: "#6b7280", fontSize: 13 }}>{t.role}</div>
                                        <div style={{ flex: 1, fontWeight: 700 }}>{t.name}</div>
                                        <div style={{ width: 40, textAlign: "center" }}>
                                            <button
                                                type="button"
                                                aria-label={`Открыть команду ${t.name}`}
                                                onClick={() => onOpenTeam && onOpenTeam(t.id)}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    fontSize: 18,
                                                    color: "#6b7280",
                                                }}
                                            >
                                                ➜
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="boards-modal-footer">
                    <button type="button" className="primary-btn" onClick={handleSave}>Сохранить</button>
                </div>
            </div>
        </div>
    );
}