import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { User } from "../types";
import { api } from "../api/client";

interface UserContextValue {
  user: User;
  setUser: (user: User) => void;
  /** Переименовать текущего пользователя на бэкенде + обновить локальное состояние. */
  updateName: (name: string) => Promise<void>;
  userInitial: string;
  workspaceName: string;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  // Единственный источник user-данных — window.dashData (рендерится сервером в
  // dashboard.tmpl, accountId/email/name берутся из БД). Отдельного round-trip'а
  // на первом рендере нет; /account/get вызывается только там, где нужны свежие
  // данные (например, при открытии ProfileModal).
  const initialDash = typeof window !== "undefined" ? window.dashData : undefined;
  const [user, setUser] = useState<User>({
    id: initialDash?.accountId,
    name: initialDash?.name || "",
    email: initialDash?.email || "",
  });
  // Workspace name пока что = имя пользователя (личный workspace). Если в
  // будущем появятся организации — добавим поле в dashData.
  const workspaceName = user.name.trim() || "Рабочее пространство";

  const updateName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const acc = await api.account.update({ name: trimmed });
    setUser((prev) => ({ id: acc.id, name: acc.name, email: acc.email || prev.email }));
  }, []);

  const userInitial = user.name ? user.name[0].toUpperCase() : "?";

  return (
    <UserContext.Provider value={{ user, setUser, updateName, userInitial, workspaceName }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
