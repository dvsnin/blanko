import { useRef } from "react";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useClickOutside } from "../hooks/useClickOutside";
import "./ProfileMenu.css";

interface ProfileMenuProps {
  name: string;
  email: string;
  onProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export default function ProfileMenu({ name, email, onProfile, onLogout, onClose }: ProfileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose);
  useClickOutside([menuRef], onClose);

  return (
    <div className="profile-menu" ref={menuRef}>
      <div className="menu-item header">{name}</div>
      <div className="menu-item small">{email}</div>
      <hr />
      <button type="button" className="menu-item" onClick={onProfile}>
        Мой профиль
      </button>
      <button type="button" className="menu-item" onClick={onLogout}>
        Выйти
      </button>
    </div>
  );
}
