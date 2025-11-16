import { useState, useRef, useEffect } from "react";
import ProfileMenu from "./ProfileMenu";
import ProfileModal from "./ProfileModal";

export default function HeaderWithProfile() {
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const profileWrapperRef = useRef(null);

    // Закрытие меню по клику вне (по всему блоку: аватарка + меню)
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
                {/* круглая кнопка с буквой T */}
                <button
                    type="button"
                    className="profile-avatar-btn"
                    onClick={() =>
                        setIsProfileMenuOpen((prev) => !prev)
                    }
                    aria-haspopup="true"
                    aria-expanded={isProfileMenuOpen}
                >
                    T
                </button>

                {isProfileMenuOpen && (
                    <ProfileMenu
                        name="test"
                        email="testuser@example.com"
                        onSettings={handleSettings}
                        onLogout={handleLogout}
                        onClose={() => setIsProfileMenuOpen(false)}
                    />
                )}
            </div>

            {isProfileModalOpen && (
                <ProfileModal
                    name="test"
                    email="testuser@example.com"
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