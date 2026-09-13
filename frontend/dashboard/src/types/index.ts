export type TeamRole = "owner" | "admin" | "member";

export interface Board {
  id: string;
  publicId: string;
  title: string;
  owner: string;
  ownerId?: string;
  updated?: string;
  /** Сырой ISO-timestamp последнего изменения — нужен для сортировки. */
  updatedAt?: string;
  lastOpened: string;
  colorKey?: string;
  isStarred?: boolean;
}

export interface Team {
  id: string;
  name: string;
  role: TeamRole;
  boards: Board[];
  isStarred: boolean;
  ownerId?: string;
  create?: boolean;
  boardCount?: number;
}

export interface User {
  id?: string;
  name: string;
  email: string;
}

export interface DashData {
  accountId?: string;
  name?: string;
  email?: string;
  /** Флаги наличия данных на первом рендере — чтобы скрыть empty-state
   *  пока TeamsContext ещё фетчит /team/list. */
  hasTeams?: boolean;
  hasBoards?: boolean;
}

declare global {
  interface Window {
    dashData?: DashData;
  }
}
