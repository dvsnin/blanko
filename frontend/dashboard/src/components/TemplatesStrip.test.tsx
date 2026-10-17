import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import TemplatesStrip from "./TemplatesStrip";
import { templatesForAge } from "../utils/templates";

describe("TemplatesStrip", () => {
  afterEach(cleanup);

  it("with age: blank + age templates, link and chip", () => {
    render(<TemplatesStrip age="3-4" onBlank={() => {}} onTemplate={() => {}} />);
    expect(screen.getByText("Пустая доска")).toBeTruthy();
    const list = templatesForAge("3-4");
    expect(list.length).toBeLessThanOrEqual(5);
    for (const t of list) expect(screen.getByText(t.title)).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(list.length + 1);
    expect(screen.getByRole("link", { name: /Все шаблоны/ }).getAttribute("href")).toBe("#/templates?age=3-4");
    expect(screen.getByText("для 3–4 года")).toBeTruthy();
  });

  it("without age: first five, plain link, no chip", () => {
    render(<TemplatesStrip onBlank={() => {}} onTemplate={() => {}} />);
    for (const t of templatesForAge(undefined)) expect(screen.getByText(t.title)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Все шаблоны/ }).getAttribute("href")).toBe("#/templates");
    expect(screen.queryByText(/^для /)).toBeNull();
  });

  it("click calls handlers", () => {
    const onTemplate = vi.fn();
    const onBlank = vi.fn();
    render(<TemplatesStrip age="3-4" onBlank={onBlank} onTemplate={onTemplate} />);
    const t = templatesForAge("3-4")[0];
    fireEvent.click(screen.getByText(t.title));
    expect(onTemplate).toHaveBeenCalledWith(t);
    fireEvent.click(screen.getByText("Пустая доска"));
    expect(onBlank).toHaveBeenCalled();
  });
});
