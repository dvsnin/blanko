import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TeacherPicker from "./TeacherPicker";
import { api } from "../api/client";
import { useState } from "react";

vi.mock("../api/client", () => ({ api: { accounts: { search: vi.fn() } } }));

const directory = [
  { id: "u1", email: "anna@example.com", name: "Анна Петрова" },
  { id: "u2", email: "olga@example.com", name: "Ольга Смирнова" },
  { id: "u3", email: "irina@example.com", name: "Ирина Волкова" },
];

function Harness({ initial = "", disabled = false }: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return <><TeacherPicker value={value} onChange={setValue} disabled={disabled} /><output data-testid="value">{value}</output></>;
}

describe("TeacherPicker", () => {
  beforeEach(() => { vi.mocked(api.accounts.search).mockResolvedValue(directory); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("показывает текущих воспитателей чипами и предлагает только остальных зарегистрированных", async () => {
    render(<Harness initial="Анна Петрова" />);
    const chips = screen.getByRole("list", { name: "Воспитатели" });
    expect(within(chips).getByText("Анна Петрова")).toBeTruthy();
    const options = await screen.findByRole("list", { name: "Педагоги сада" });
    expect(within(options).queryByText("Анна Петрова")).toBeNull();
    expect(within(options).getAllByRole("listitem")).toHaveLength(2);
  });

  it("поиск по имени и почте, клик добавляет имя к списку через запятую", async () => {
    render(<Harness initial="Анна Петрова" />);
    await screen.findByRole("list", { name: "Педагоги сада" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Найти воспитателя" }), { target: { value: "irina@" } });
    const options = screen.getByRole("list", { name: "Педагоги сада" });
    expect(within(options).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(within(options).getByRole("button", { name: "Добавить: Ирина Волкова" }));
    expect(screen.getByTestId("value").textContent).toBe("Анна Петрова, Ирина Волкова");
    expect(screen.getByRole("searchbox", { name: "Найти воспитателя" }).getAttribute("value")).toBe("");
  });

  it("крестик на чипе убирает воспитателя, пустой список даёт пустую строку", async () => {
    render(<Harness initial="Анна Петрова, Ольга Смирнова" />);
    fireEvent.click(screen.getByRole("button", { name: "Убрать: Анна Петрова" }));
    expect(screen.getByTestId("value").textContent).toBe("Ольга Смирнова");
    fireEvent.click(screen.getByRole("button", { name: "Убрать: Ольга Смирнова" }));
    expect(screen.getByTestId("value").textContent).toBe("");
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Педагоги сада" })).getAllByRole("listitem")).toHaveLength(3));
  });

  it("без права редактирования: чипы без крестиков, поиска нет, справочник не грузится", () => {
    render(<Harness initial="Анна Петрова" disabled />);
    expect(within(screen.getByRole("list", { name: "Воспитатели" })).getByText("Анна Петрова")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Убрать/ })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(api.accounts.search).not.toHaveBeenCalled();
  });
});
