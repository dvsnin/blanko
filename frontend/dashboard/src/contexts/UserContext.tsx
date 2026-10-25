import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { User } from "../types";
import { api } from "../api/client";

export interface UserContextValue {
  user: User;
  setUser: (user: User) => void;
  /** Переименовать текущего пользователя на бэкенде + обновить локальное состояние. */
  updateName: (name: string) => Promise<void>;
  userInitial: string;
  workspaceName: string;
}

export const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  // Данные пользователя приходят в window.dashData; /account/get только там, где нужны свежие.
  const initialDash = typeof window !== "undefined" ? window.dashData : undefined;
  const [user, setUser] = useState<User>({
    id: initialDash?.accountId,
    name: initialDash?.name || "",
    email: initialDash?.email || "",
    orgRole: initialDash?.orgRole,
  });
  const workspaceName = (initialDash?.orgName ?? "").trim() || "Blanko";

  const updateName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const acc = await api.account.update({ name: trimmed });
    setUser((prev) => ({ id: acc.id, name: acc.name, email: acc.email || prev.email, orgRole: acc.orgRole || prev.orgRole }));
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
