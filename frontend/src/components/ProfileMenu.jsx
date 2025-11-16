// ProfileMenu.jsx
import { useEffect, useRef } from "react";

export default function ProfileMenu({
                                        name,
                                        email,
                                        onSettings,
                                        onLogout,
                                        onClose,
                                    }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose?.();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose?.();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="profile-menu" ref={menuRef}>
            <div className="menu-item header">{name}</div>
            <div className="menu-item small">{email}</div>
            <hr />
            <button
                type="button"
                className="menu-item"
                onClick={onSettings}
            >
                Настройки
            </button>
            <button
                type="button"
                className="menu-item"
                onClick={onLogout}
            >
                Выйти
            </button>
        </div>
    );
}
