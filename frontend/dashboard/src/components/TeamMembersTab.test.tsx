import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TeamMembersTab from "./TeamMembersTab";
import { api } from "../api/client";
import type { TeamMemberDTO } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    teams: { members: vi.fn(), addMember: vi.fn(), setMemberRole: vi.fn(), removeMember: vi.fn() },
    accounts: { search: vi.fn() },
  },
}));

const owner: TeamMemberDTO = { accountId: "u1", email: "anna@example.com", name: "Анна Петрова", role: "owner", joinedAt: "" };
const member: TeamMemberDTO = { accountId: "u2", email: "masha@example.com", name: "Мария Сидорова", role: "member", joinedAt: "" };
const directory = [
  { id: "u1", email: "anna@example.com", name: "Анна Петрова" },
  { id: "u2", email: "masha@example.com", name: "Мария Сидорова" },
  { id: "u3", email: "olga@example.com", name: "Ольга Смирнова" },
  { id: "u4", email: "irina@example.com", name: "Ирина Волкова" },
];

describe("TeamMembersTab", () => {
  beforeEach(() => {
    vi.mocked(api.teams.members).mockResolvedValue([owner, member]);
    vi.mocked(api.accounts.search).mockResolvedValue(directory);
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("показывает участников: владельца без управления, участника с ролью и исключением", async () => {
    render(<TeamMembersTab teamId="t1" canManage />);
    const list = await screen.findByRole("list", { name: "Участники группы" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("владелец")).toBeTruthy();
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(within(rows[1]).getByRole("combobox", { name: "Роль: masha@example.com" })).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: "Исключить: masha@example.com" })).toBeTruthy();
  });

  it("в кандидатах только те, кого нет в группе; поиск по имени и почте", async () => {
    render(<TeamMembersTab teamId="t1" canManage />);
    const cands = await screen.findByRole("list", { name: "Педагоги сада" });
    expect(within(cands).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Добавить участников"), { target: { value: "волк" } });
    expect(within(screen.getByRole("list", { name: "Педагоги сада" })).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Добавить участников"), { target: { value: "olga@" } });
    expect(within(screen.getByRole("list", { name: "Педагоги сада" })).getByText("olga@example.com")).toBeTruthy();
  });

  it("добавляет нескольких отмеченных одним нажатием", async () => {
    vi.mocked(api.teams.addMember).mockImplementation(async (_t, email, role) => ({
      accountId: email, email, name: email.split("@")[0], role, joinedAt: "",
    }));
    render(<TeamMembersTab teamId="t1" canManage />);
    await screen.findByRole("list", { name: "Педагоги сада" });
    fireEvent.click(screen.getByLabelText("Выбрать: olga@example.com"));
    fireEvent.click(screen.getByLabelText("Выбрать: irina@example.com"));
    fireEvent.change(screen.getByLabelText("Роль"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить (2)" }));
    await waitFor(() => expect(api.teams.addMember).toHaveBeenCalledTimes(2));
    expect(api.teams.addMember).toHaveBeenCalledWith("t1", "olga@example.com", "admin");
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Участники группы" })).getAllByRole("listitem")).toHaveLength(4));
  });

  it("неизвестная почта: предлагает пригласить заранее", async () => {
    vi.mocked(api.teams.addMember).mockResolvedValue({ accountId: "u9", email: "new@example.com", name: "new", role: "member", joinedAt: "" });
    render(<TeamMembersTab teamId="t1" canManage />);
    await screen.findByRole("list", { name: "Педагоги сада" });
    fireEvent.change(screen.getByLabelText("Добавить участников"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Пригласить new@example.com" }));
    await waitFor(() => expect(api.teams.addMember).toHaveBeenCalledWith("t1", "new@example.com", "member"));
    await waitFor(() => expect(screen.getByText("new@example.com")).toBeTruthy());
  });

  it("исключение убирает строку, смена роли зовёт API", async () => {
    vi.mocked(api.teams.removeMember).mockResolvedValue(undefined);
    vi.mocked(api.teams.setMemberRole).mockResolvedValue({ ...member, role: "admin" });
    render(<TeamMembersTab teamId="t1" canManage />);
    await screen.findByRole("list", { name: "Участники группы" });
    fireEvent.change(screen.getByRole("combobox", { name: "Роль: masha@example.com" }), { target: { value: "admin" } });
    await waitFor(() => expect(api.teams.setMemberRole).toHaveBeenCalledWith("t1", "u2", "admin"));
    fireEvent.click(screen.getByRole("button", { name: "Исключить: masha@example.com" }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Участники группы" })).queryByText("masha@example.com")).toBeNull());
  });

  it("без права управления нет поиска и кнопок", async () => {
    render(<TeamMembersTab teamId="t1" canManage={false} />);
    await screen.findByRole("list", { name: "Участники группы" });
    expect(screen.queryByLabelText("Добавить участников")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(api.accounts.search).not.toHaveBeenCalled();
  });
});
