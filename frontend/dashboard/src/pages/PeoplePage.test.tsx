import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import PeoplePage from "./PeoplePage";
import { UserContext, type UserContextValue } from "../contexts/UserContext";
import { api, ApiError, type AccountListDTO } from "../api/client";

vi.mock("../api/client", () => {
  class ApiError extends Error {
    status: number; code?: string;
    constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
  }
  return { ApiError, api: { accounts: { list: vi.fn(), setRole: vi.fn() } } };
});

const accounts: AccountListDTO[] = [
  { id: "u1", name: "Анна Петрова", email: "anna@example.com", orgRole: "admin" },
  { id: "u2", name: "Борис Иванов", email: "boris@example.com", orgRole: "member" },
  { id: "u3", name: "Вера Смирнова", email: "vera@example.com", orgRole: "owner" },
];

function setup(orgRole: "owner" | "admin" | "member" = "admin") {
  const user = {
    user: { id: "u1", name: "Анна Петрова", email: "anna@example.com", orgRole },
    setUser: vi.fn(), updateName: vi.fn(), userInitial: "А", workspaceName: "Сад",
  } as unknown as UserContextValue;
  render(<UserContext.Provider value={user}><PeoplePage /></UserContext.Provider>);
}

const rowOf = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("PeoplePage: учётные записи сада", () => {
  beforeEach(() => {
    vi.mocked(api.accounts.list).mockResolvedValue(accounts);
    vi.mocked(api.accounts.setRole).mockImplementation(async (id, role) => ({ ...accounts.find((a) => a.id === id)!, orgRole: role }));
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("показывает всех с ролями «Администратор» и «Пользователь», владельца тоже как администратора", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Борис Иванов")).toBeTruthy());
    expect(within(rowOf("Анна Петрова")).getByText("Администратор")).toBeTruthy();
    expect(within(rowOf("Борис Иванов")).getByText("Пользователь")).toBeTruthy();
    expect(within(rowOf("Вера Смирнова")).getByText("Администратор")).toBeTruthy();
    expect(screen.getByText("3 учётные записи · 2 администратора")).toBeTruthy();
  });

  it("назначает администратора и снимает права через кнопки строки", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Борис Иванов")).toBeTruthy());
    fireEvent.click(within(rowOf("Борис Иванов")).getByRole("button", { name: "Сделать администратором" }));
    await waitFor(() => expect(api.accounts.setRole).toHaveBeenCalledWith("u2", "admin"));
    await waitFor(() => expect(within(rowOf("Борис Иванов")).getByText("Администратор")).toBeTruthy());
    fireEvent.click(within(rowOf("Вера Смирнова")).getByRole("button", { name: "Снять права администратора" }));
    await waitFor(() => expect(api.accounts.setRole).toHaveBeenCalledWith("u3", "member"));
    await waitFor(() => expect(within(rowOf("Вера Смирнова")).getByText("Пользователь")).toBeTruthy());
  });

  it("снятие прав с себя спрашивает подтверждение", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Борис Иванов")).toBeTruthy());
    fireEvent.click(within(rowOf("Анна Петрова")).getByRole("button", { name: "Снять права администратора" }));
    expect(api.accounts.setRole).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Снять права" }));
    await waitFor(() => expect(api.accounts.setRole).toHaveBeenCalledWith("u1", "member"));
  });

  it("последнего администратора снять нельзя: сервер отвечает last_admin, показываем подсказку", async () => {
    vi.mocked(api.accounts.setRole).mockRejectedValue(new ApiError(409, "last admin", "last_admin"));
    setup();
    await waitFor(() => expect(screen.getByText("Борис Иванов")).toBeTruthy());
    fireEvent.click(within(rowOf("Вера Смирнова")).getByRole("button", { name: "Снять права администратора" }));
    await waitFor(() => expect(screen.getByText("У сада должен остаться хотя бы один администратор")).toBeTruthy());
    expect(within(rowOf("Вера Смирнова")).getByText("Администратор")).toBeTruthy();
  });

  it("поиск фильтрует по имени и почте", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("Борис Иванов")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Найти учётную запись"), { target: { value: "vera@" } });
    expect(screen.queryByText("Борис Иванов")).toBeNull();
    expect(screen.getByText("Вера Смирнова")).toBeTruthy();
  });

  it("пользователю без прав раздел не показывается", async () => {
    setup("member");
    expect(api.accounts.list).not.toHaveBeenCalled();
    expect(screen.getByText("Раздел доступен только администраторам")).toBeTruthy();
  });
});
