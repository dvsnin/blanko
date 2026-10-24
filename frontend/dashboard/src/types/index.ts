import type { AgeKey, TopicKey } from "../constants/templates";

export type TeamRole = "owner" | "admin" | "member";

export type BoardAccess = "deny" | "view" | "edit";

export interface Board {
  id: string;
  publicId: string;
  title: string;
  owner: string;
  ownerId?: string;
  updated?: string;
  /** Сырой ISO-timestamp последнего изменения - нужен для сортировки. */
  updatedAt?: string;
  /** Raw ISO: когда доску открывали в последний раз (для сортировки «Недавние») */
  lastOpenedAt?: string;
  /** Raw ISO: когда доску создали. */
  createdAt?: string;
  lastOpened: string;
  colorKey?: string;
  isStarred?: boolean;
  canEdit?: boolean;
  /** Что могут участники группы с содержимым: edit, view или deny. */
  teamAccess?: BoardAccess;
  /** Любой вошедший открывает доску по ссылке только для чтения. */
  linkAccessEnabled?: boolean;
  templateId?: string;
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
  colorKey?: string;
  ageGroup?: AgeKey;
  /** Воспитатели группы, свободный текст. */
  teachers?: string;
}

export type OrgRole = "owner" | "admin" | "member";

export interface User {
  id?: string;
  name: string;
  email: string;
  orgRole?: OrgRole;
}

export type TemplateSource = "preset" | "own";

/** Шаблон занятия из API. */
export interface Template {
  id: string;
  publicId: string;
  name: string;
  description: string;
  topic: TopicKey;
  ages: AgeKey[];
  durationMin: number;
  /** Пусто: считать из названия. */
  glyph?: string;
  source: TemplateSource;
  authorId?: string;
  authorName?: string;
  isStarred: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInput {
  name: string;
  description: string;
  topic: TopicKey;
  ages: AgeKey[];
  durationMin: number;
}

export interface DashData {
  accountId?: string;
  name?: string;
  email?: string;
  orgRole?: OrgRole;
  orgName?: string;
  /** Флаги наличия данных на первом рендере - чтобы скрыть empty-state
   *  пока TeamsContext ещё фетчит /team/list. */
  hasTeams?: boolean;
  hasBoards?: boolean;
}

declare global {
  interface Window {
    dashData?: DashData;
  }
}
