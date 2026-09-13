/**
 * HTTP client for the Blanko backend API.
 *
 * Routing convention: все API-action-эндпоинты — POST на /app/api/v1/<resource>/<action>,
 * исключения — страничные GET /app/dashboard и /app/board/:uid.
 *
 * accountId текущего пользователя прокидывается сервером в window.dashData.accountId
 * и автоматически добавляется в тело каждого запроса; бэкенд валидирует его против
 * сессии oauth2-proxy.
 */

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
}

export interface TeamDTO {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  isStarred: boolean;
  boardCount: number;
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
  teamAccess: "deny" | "view" | "edit";
  linkAccessEnabled: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface List<T> {
  items: T[];
}

/* ---------- API ---------- */

export const api = {
  account: {
    get: () => post<AccountDTO>("/account/get"),
    update: (patch: { name?: string }) => post<AccountDTO>("/account/update", patch),
  },

  teams: {
    list: () => post<List<TeamDTO>>("/team/list").then((r) => r.items ?? []),
    create: (name: string) => post<TeamDTO>("/team/create", { name }),
    update: (id: string, patch: { name?: string }) =>
      post<TeamDTO>("/team/update", { id, ...patch }),
    delete: (id: string) => post<void>("/team/delete", { id }),
    leave: (id: string) => post<void>("/team/leave", { id }),
    star: (id: string) => post<void>("/team/star", { id }),
    unstar: (id: string) => post<void>("/team/unstar", { id }),
  },

  boards: {
    listByTeam: (teamId: string) =>
      post<List<BoardDTO>>("/board/list", { teamId }).then((r) => r.items ?? []),
    create: (teamId: string, name?: string) =>
      post<BoardDTO>("/board/create", { teamId, name: name ?? "" }),
    update: (
      id: string,
      patch: { name?: string; teamAccess?: string; linkAccessEnabled?: boolean },
    ) => post<BoardDTO>("/board/update", { id, ...patch }),
    delete: (id: string) => post<void>("/board/delete", { id }),
    star: (id: string) => post<void>("/board/star", { id }),
    unstar: (id: string) => post<void>("/board/unstar", { id }),
  },
};
