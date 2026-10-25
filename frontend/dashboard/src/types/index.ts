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
  /** Что могут участники группы с содержимым: edit, view или deny (действующее значение). */
  teamAccess?: BoardAccess;
  /** У доски нет своей настройки: уровень взят из группы. */
  teamAccessInherited?: boolean;
  /** Любой вошедший открывает доску по ссылке только для чтения. */
  linkAccessEnabled?: boolean;
  /** Режим показа: экран без входа следует за ведущим. Токен и код видны только тем, кто управляет доской. */
  presentEnabled?: boolean;
  presentToken?: string;
  /** ISO; пусто - пока не выключат. */
  presentExpiresAt?: string;
  presenterId?: string;
  presenterName?: string;
  templateId?: string;
}

export interface Team {
  id: string;
  name: string;
  role: TeamRole;
  /** Последние открытые доски группы (до 3) для карточки группы; полный список приходит страницами. */
  recentBoards: Board[];
  /** Число досок группы, видимых пользователю; приходит с сервера. */
  boardCount: number;
  isStarred: boolean;
  ownerId?: string;
  create?: boolean;
  colorKey?: string;
  ageGroup?: AgeKey;
  /** Воспитатели группы, свободный текст. */
  teachers?: string;
  /** Доступ участников к доскам группы по умолчанию; доска может переопределить. */
  memberBoardAccess?: BoardAccess;
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
  /** Настройки кабинета с аккаунта: последняя группа, режим и сортировка досок, фильтры. */
  prefs?: Record<string, string | number | boolean>;
}

declare global {
  interface Window {
    dashData?: DashData;
  }
}
