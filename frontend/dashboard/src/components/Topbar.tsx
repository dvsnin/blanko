import { useEffect, useRef, useState } from "react";
import "./Topbar.css";
import NotificationButton from "./NotificationButton";
import NotificationsPanel from "./NotificationsPanel";
import ProfileButton from "./ProfileButton";
import ProfileMenu from "./ProfileMenu";
import TeamSwitcher from "./TeamSwitcher";
import { useUser } from "../contexts/UserContext";
import { useHashRoute, navigate, type Route } from "../hooks/useHashRoute";
import { LOGO_SVG } from "../constants/templates";

const NAV: ReadonlyArray<{ name: Route["name"]; href: string; label: string }> = [
  { name: "boards", href: "#/", label: "Доски" },
  { name: "templates", href: "#/templates", label: "Шаблоны" },
  { name: "groups", href: "#/groups", label: "Группы" },
];

export default function Topbar() {
  const route = useHashRoute();
  const { user, userInitial } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notificationsOpen]);

  return (
    <header className="topbar">
      <a className="topbar__logo" href="#/" aria-label="Blanko">
        <span className="topbar__logo-mark" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
        <span className="topbar__logo-text">Blanko</span>
      </a>

      <div className="topbar__switcher">
        <TeamSwitcher />
      </div>

      <nav className="topbar__nav" aria-label="Разделы">
        {NAV.map((n) => (
          <a
            key={n.name}
            href={n.href}
            className={`topbar__nav-link${route.name === n.name ? " topbar__nav-link--on" : ""}`}
            aria-current={route.name === n.name ? "page" : undefined}
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className="topbar__right">
        <NotificationButton unreadCount={0} onClick={() => setNotificationsOpen((v) => !v)} />
        <ProfileButton userInitial={userInitial} onClick={() => setMenuOpen((v) => !v)} />
        {menuOpen && (
          <ProfileMenu
            name={user.name || "Пользователь"}
            email={user.email || "user@example.com"}
            onProfile={() => {
              setMenuOpen(false);
              navigate({ name: "profile" });
            }}
            onLogout={() => {
              window.location.href = "/app/logout";
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      <NotificationsPanel
        ref={notificationsRef}
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </header>
  );
}
