import { useState } from "react";
import "./styles/global.css";
import "./app.css";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Boards from "./components/Boards";
import ProfileModal from "./components/ProfileModal";

/* ============================= APP ============================= */

export default function App() {
    const [user, setUser] = useState({
        name: window.dashData?.name || "",
        email: window.dashData?.email || ""
    });

    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const handleProfileSave = (newName) => {
        setUser((prev) => ({ ...prev, name: newName }));
        if (typeof window !== "undefined" && window.dashData) {
            window.dashData.name = newName;
        }
        setIsProfileModalOpen(false);
    };

    return (
        <div className="app-layout">
            {/* -------- SIDEBAR слева -------- */}
            <Sidebar />

            {/* -------- Контент справа -------- */}
            <div className="content">
                {/* Topbar */}
                <Topbar 
                    user={user} 
                    onProfileSave={() => setIsProfileModalOpen(true)} 
                />

                {/* Main Boards Content */}
                <Boards />

                {/* Profile Modal */}
                {isProfileModalOpen && (
                    <ProfileModal
                        name={user.name}
                        email={user.email}
                        onClose={() => setIsProfileModalOpen(false)}
                        onSave={handleProfileSave}
                    />
                )}
            </div>
        </div>
    );
}
