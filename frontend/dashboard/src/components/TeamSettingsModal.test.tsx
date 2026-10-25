import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import TeamSettingsModal from "./TeamSettingsModal";
import type { Team } from "../types";

vi.mock("../api/client", () => ({ api: { accounts: { search: vi.fn().mockResolvedValue([]) }, teams: { members: vi.fn().mockResolvedValue([]) } } }));

const team = (role: Team["role"]): Team => ({ id: "t1", name: "Ромашка", role, recentBoards: [], boardCount: 2, isStarred: false, memberBoardAccess: "edit" });

// Доступ участников к доскам задаётся один раз в группе и наследуется каждой её доской.
describe("TeamSettingsModal: доступ участников к доскам", () => {
  afterEach(cleanup);

  it("владелец выбирает уровень, он уходит в onSave вместе с остальными полями", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TeamSettingsModal team={team("owner")} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} onLeave={vi.fn()} />);
    const select = screen.getByLabelText("Доступ участников к доскам") as HTMLSelectElement;
    expect(select.value).toBe("edit");
    fireEvent.change(select, { target: { value: "view" } });
    expect(screen.getByText(/новые доски группы наследуют этот уровень/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("t1", { name: "Ромашка", ageGroup: "", teachers: "", memberBoardAccess: "view" }));
  });

  it("участник видит уровень, но не меняет", () => {
    render(<TeamSettingsModal team={team("member")} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} onLeave={vi.fn()} />);
    expect((screen.getByLabelText("Доступ участников к доскам") as HTMLSelectElement).disabled).toBe(true);
  });
});
