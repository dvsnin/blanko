// Клиент API: все действия POST на /app/api/v1/<resource>/<action>, accountId из dashData
// добавляется в тело каждого запроса и сверяется сервером с сессией.
const API_BASE = "/app/api/v1";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getAccountId(): string {
  const id = window.dashData?.accountId;
  if (!id) {
    throw new ApiError(401, "accountId is not available in dashData", "no_account");
  }
  return id;
}

async function post<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const body = { accountId: getAccountId(), ...payload };

  const res = await fetch(`${API_BASE}${action}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const parsed = text ? safeParseJSON(text) : undefined;

  if (!res.ok) {
    const message = (parsed && (parsed.message || parsed.error)) || res.statusText || "Request failed";
    const code = parsed?.error;
    throw new ApiError(res.status, message, code);
  }

  return parsed as T;
}

function safeParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/* ---------- DTOs (mirror backend models) ---------- */

export interface AccountDTO {
  id: string;
  email: string;
  name: string;
  orgRole: "owner" | "admin" | "member";
  prefs: Record<string, string | number | boolean>;
}

export interface TemplateDTO {
  id: string;
  publicId: string;
  name: string;
  description: string;
  topic: string;
  ages: string[];
  durationMin: number;
  source: "preset" | "own";
  authorId: string;
  authorName: string;
  isStarred: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInputDTO {
  name?: string;
  description?: string;
  topic?: string;
  ages?: string[];
  durationMin?: number;
}

export interface AccountSearchDTO {
  id: string;
  email: string;
  name: string;
}

export interface TeamMemberDTO {
  accountId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface TeamDTO {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  isStarred: boolean;
  boardCount: number;
  /** Последние открытые доски группы (до 3), только видимые пользователю. */
  recentBoards: BoardDTO[];
  /** Доступ участников к доскам группы по умолчанию. */
  memberBoardAccess: "deny" | "view" | "edit";
  ageGroup: string;
  teachers: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardDTO {
  id: string;
  publicId: string;
  name: string;
  teamId: string;
  ownerId: string;
  ownerName: string;
  /** Действующий доступ участников группы: своя настройка доски или уровень группы. */
  teamAccess: "deny" | "view" | "edit";
  teamAccessInherited: boolean;
  linkAccessEnabled: boolean;
  presentEnabled: boolean;
  presentToken: string;
  presentExpiresAt: string;
  presenterId: string;
  presenterName: string;
  templateId: string;
  isStarred: boolean;
  /** Создатель доски или owner/admin группы: можно переименовать, удалить, перенести. */
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export type BoardSort = "recent" | "updated" | "name";
export type BoardSegment = "all" | "mine" | "starred";

export interface BoardListParams {
  teamId?: string;
  /** Поиск по другим группам: вычесть текущую. */
  excludeTeamId?: string;
  q?: string;
  segment?: BoardSegment;
  sort?: BoardSort;
  /** nextCursor предыдущей страницы. */
  cursor?: string;
  limit?: number;
}

export interface BoardPage {
  items: BoardDTO[];
  /** Пусто - страниц больше нет. */
  nextCursor: string;
  /** Всего досок под тем же фильтром. */
  total: number;
}

export interface AccountListDTO {
  id: string;
  name: string;
  email: string;
  orgRole: "owner" | "admin" | "member";
}

interface List<T> {
  items: T[];
}

/* ---------- API ---------- */

export const api = {
  account: {
    get: () => post<AccountDTO>("/account/get"),
    update: (patch: { name?: string }) => post<AccountDTO>("/account/update", patch),
    /** Слияние настроек кабинета: null удаляет ключ. Ответ - полный объект после слияния. */
    updatePrefs: (set: Record<string, string | number | boolean | null>) =>
      post<{ prefs: Record<string, string | number | boolean> }>("/account/prefs", { set }).then((r) => r.prefs),
  },

  teams: {
    list: () => post<List<TeamDTO>>("/team/list").then((r) => r.items ?? []),
    create: (name: string, ageGroup?: string, teachers?: string) =>
      post<TeamDTO>("/team/create", {
        name,
        ...(ageGroup ? { ageGroup } : {}),
        ...(teachers ? { teachers } : {}),
      }),
    update: (id: string, patch: { name?: string; ageGroup?: string; teachers?: string; memberBoardAccess?: "deny" | "view" | "edit" }) =>
      post<TeamDTO>("/team/update", { id, ...patch }),
    delete: (id: string) => post<void>("/team/delete", { id }),
    leave: (id: string) => post<void>("/team/leave", { id }),
    star: (id: string) => post<void>("/team/star", { id }),
    unstar: (id: string) => post<void>("/team/unstar", { id }),
    members: (teamId: string) => post<List<TeamMemberDTO>>("/team/members", { teamId }).then((r) => r.items ?? []),
    addMember: (teamId: string, email: string, role: "member" | "admin") =>
      post<TeamMemberDTO>("/team/member/add", { teamId, email, role }),
    setMemberRole: (teamId: string, memberId: string, role: "member" | "admin") =>
      post<TeamMemberDTO>("/team/member/role", { teamId, memberId, role }),
    removeMember: (teamId: string, memberId: string) => post<void>("/team/member/remove", { teamId, memberId }),
  },

  accounts: {
    /** Все учётные записи сада по части имени или почты; пустой запрос - все. */
    search: (q: string) => post<List<AccountSearchDTO>>("/account/search", { q }).then((r) => r.items ?? []),
    /** Все учётные записи с ролями организации; только администратору. */
    list: () => post<List<AccountListDTO>>("/account/list", {}).then((r) => r.items ?? []),
    /** Назначить или снять администратора сада. */
    setRole: (id: string, role: "admin" | "member") => post<AccountListDTO>("/account/role", { id, role }),
  },

  boards: {
    /** Страница досок: группы teamId или всех групп пользователя (без teamId). */
    list: (params: BoardListParams) =>
      post<BoardPage>("/board/list", { ...params }).then((r) => ({ items: r.items ?? [], nextCursor: r.nextCursor ?? "", total: r.total ?? 0 })),
    create: (teamId: string, name?: string, templateId?: string) =>
      post<BoardDTO>("/board/create", {
        teamId,
        name: name ?? "",
        ...(templateId ? { templateId } : {}),
      }),
    update: (
      id: string,
      patch: { name?: string; teamAccess?: string; linkAccessEnabled?: boolean },
    ) => post<BoardDTO>("/board/update", { id, ...patch }),
    delete: (id: string) => post<void>("/board/delete", { id }),
    star: (id: string) => post<void>("/board/star", { id }),
    unstar: (id: string) => post<void>("/board/unstar", { id }),
    duplicate: (id: string) => post<BoardDTO>("/board/duplicate", { id }),
    move: (id: string, teamId: string) => post<BoardDTO>("/board/move", { id, teamId }),
    /** Показ на экране: включить на hours часов (0 - пока не выключат), выключить, стать ведущим. */
    presentEnable: (id: string, hours: number) => post<BoardDTO>("/board/present/enable", { id, hours }),
    presentDisable: (id: string) => post<BoardDTO>("/board/present/disable", { id }),
    presentLead: (id: string) => post<BoardDTO>("/board/present/lead", { id }),
  },

  templates: {
    list: () => post<List<TemplateDTO>>("/template/list").then((r) => r.items ?? []),
    create: (input: Required<TemplateInputDTO>, fromBoardId?: string) =>
      post<TemplateDTO>("/template/create", { ...input, ...(fromBoardId ? { fromBoardId } : {}) }),
    update: (id: string, patch: TemplateInputDTO) => post<TemplateDTO>("/template/update", { id, ...patch }),
    delete: (id: string) => post<void>("/template/delete", { id }),
    duplicate: (id: string) => post<TemplateDTO>("/template/duplicate", { id }),
    star: (id: string) => post<void>("/template/star", { id }),
    unstar: (id: string) => post<void>("/template/unstar", { id }),
  },
};
