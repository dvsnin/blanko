import { useState, useRef } from "react";
import ProfileMenu from "./ProfileMenu";
import NotificationsPanel from "./NotificationsPanel";
import "./Topbar.css";

export default function Topbar({ user, onProfileSave }) {
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const notificationsRef = useRef(null);

    const userInitial = user?.name ? user.name[0].toUpperCase() : "?";

    return (
        <>
            <header className="topbar">
                <div className="topbar-left">
                    <span className="topbar-logo">Blanko</span>
                </div>

                <div className="topbar-right">
                    <button 
                        type="button" 
                        className="topbar-icon-btn" 
                        aria-label="Notifications" 
                        onMouseDown={(e) => e.stopPropagation()} 
                        onClick={() => setIsNotificationsOpen((v) => !v)}
                    >
                        <svg 
                            className="bell-icon" 
                            width="22" 
                            height="22" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                    </button>

                    <button 
                        type="button" 
                        className="topbar-avatar" 
                        aria-label="Profile menu"
                        onMouseDown={(e) => e.stopPropagation()} 
                        onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    >
                        {userInitial}
                    </button>

                    {isProfileMenuOpen && (
                        <ProfileMenu
                            name={user?.name || "User"}
                            email={user?.email || "user@example.com"}
                            onSettings={() => {
                                setIsProfileMenuOpen(false);
                                if (onProfileSave) {
                                    // Trigger parent to open profile modal
                                    onProfileSave();
                                }
                            }}
                            onLogout={() => console.log("Logout clicked")}
                            onClose={() => setIsProfileMenuOpen(false)}
                        />
                    )}
                </div>
            </header>

            <NotificationsPanel 
                ref={notificationsRef} 
                isOpen={isNotificationsOpen} 
                onClose={() => setIsNotificationsOpen(false)} 
            />

            <div className="topbar-divider" />
        </>
    );
}
