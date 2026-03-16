import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "../types";

interface UserContextValue {
  user: User;
  setUser: (user: User) => void;
  userInitial: string;
  workspaceName: string;
  login: string;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({ name: "", email: "" });
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [login, setLogin] = useState("dvsnin");

  useEffect(() => {
    const dash = window.dashData;
    if (dash) {
      setUser({ name: dash.name || "", email: dash.email || "" });
      const w =
        (dash.workspaceName && String(dash.workspaceName).trim()) ||
        (dash.name && String(dash.name).trim()) ||
        "Workspace";
      setWorkspaceName(w);
      if (dash.login) setLogin(dash.login);
    }
  }, []);

  const userInitial = user.name ? user.name[0].toUpperCase() : "?";

  return (
    <UserContext.Provider value={{ user, setUser, userInitial, workspaceName, login }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
