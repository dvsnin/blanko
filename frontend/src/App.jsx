import { useState } from "react";
import "./app.css";

import Boards from "./components/Boards";
import ProfileModal from "./components/ProfileModal";

/* ===================== Mock API (готово к замене) ===================== */

const api = {
    updateProfile: async (data) => {
        console.log("Sending to backend:", data);
        await new Promise((res) => setTimeout(res, 300));
        return { ok: true };
    },
};

/* ============================= Sidebar ============================= */

function Sidebar() {
    return (
        <div className="sidebar">
            <div className="sidebar-item active">
                <span className="icon">⌂</span>
                <span className="label">Home</span>
            </div>

            <div className="sidebar-item">
                <span className="icon">⏱</span>
                <span className="label">Recent</span>
            </div>

            <div className="sidebar-item">
                <span className="icon">☆</span>
                <span className="label">Starred</span>
            </div>
        </div>
    );
}

/* ============================= APP ============================= */

export default function App() {
    const { name, email } = window.dashData;

    const [openModal, setOpenModal] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [currentName, setCurrentName] = useState(name);

    async function handleSave(newName) {
        const res = await api.updateProfile({ name: newName });

        if (res.ok) {
            setCurrentName(newName);
            window.dashData.name = newName;

            setOpenModal(false);
            setShowToast(true);

            setTimeout(() => setShowToast(false), 2000);
        }
    }

    return (
        <div className="app-layout">

            {/* -------- SIDEBAR слева -------- */}
            <Sidebar />

            {/* -------- Контент справа -------- */}
            <div className="content">

                <Boards />

                {/* Модалка */}
                {openModal && (
                    <ProfileModal
                        name={currentName}
                        email={email}
                        onClose={() => setOpenModal(false)}
                        onSave={handleSave}
                    />
                )}

                {/* Toast */}
                {showToast && (
                    <div className="toast">
                        <span className="toast-icon">✔</span>
                        <span>Сохранено</span>
                    </div>
                )}
            </div>
        </div>
    );
}
