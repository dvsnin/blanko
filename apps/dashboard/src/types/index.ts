export type TeamRole = "owner" | "admin" | "member";

export interface Board {
  id: number;
  title: string;
  owner: string;
  updated?: string;
  lastOpened: string;
  colorKey?: string;
}

export interface Team {
  id: string;
  name: string;
  role: TeamRole;
  boards: Board[];
  isStarred: boolean;
  ownerId?: string;
  create?: boolean;
}

export interface User {
  name: string;
  email: string;
}

export interface DashData {
  name?: string;
  email?: string;
  login?: string;
  workspaceName?: string;
}

declare global {
  interface Window {
    dashData?: DashData;
  }
}
