import { useState, useRef, useEffect } from "react";
import ProfileMenu from "./ProfileMenu";
import ProfileModal from "./ProfileModal";

export default function HeaderWithProfile({ name = "User", email = "", teams = [], activeTeamId = null, onOpenTeam }) {
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const profileWrapperRef = useRef(null);

    // Закрытие меню по клику вне
    useEffect(() => {
        if (!isProfileMenuOpen) return;

        function handleClickOutside(e) {
            if (
                profileWrapperRef.current &&
                !profileWrapperRef.current.contains(e.target)
            ) {
                setIsProfileMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isProfileMenuOpen]);

    const handleSettings = () => {
        setIsProfileMenuOpen(false);
        setIsProfileModalOpen(true);
    };

    const handleLogout = () => {
        setIsProfileMenuOpen(false);
        console.log("logout");
    };

    return (
        <>
            <div
                className="header-profile-wrapper"
                ref={profileWrapperRef}
            >
                <button
                    type="button"
                    className="profile-avatar-btn"
                    onClick={() =>
                        setIsProfileMenuOpen((prev) => !prev)
                    }
                    aria-haspopup="true"
                    aria-expanded={isProfileMenuOpen}
                >
                    {name ? name[0].toUpperCase() : "U"}
                </button>

                {isProfileMenuOpen && (
                    <ProfileMenu
                        name={name}
                        email={email}
                        onSettings={handleSettings}
                        onLogout={handleLogout}
                        onClose={() => setIsProfileMenuOpen(false)}
                    />
                )}
            </div>

            {isProfileModalOpen && (
                <ProfileModal
                    name={name}
                    email={email}
                    teams={teams}
                    activeTeamId={activeTeamId}
                    onOpenTeam={(id) => {
                        if (typeof onOpenTeam === "function") onOpenTeam(id);
                        setIsProfileModalOpen(false);
                    }}
                    onClose={() => setIsProfileModalOpen(false)}
                    onSave={(newName) => {
                        console.log("save name", newName);
                        setIsProfileModalOpen(false);
                    }}
                />
            )}
        </>
    );
}