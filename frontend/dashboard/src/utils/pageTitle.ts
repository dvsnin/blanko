import type { Route } from "../hooks/useHashRoute";

const SECTION: Record<Route["name"], string> = {
  boards: "Доски",
  templates: "Шаблоны",
  groups: "Группы",
  profile: "Профиль",
};

/** Заголовок вкладки: «Раздел · Название сада»; без названия сада только раздел. */
export function pageTitle(route: Route, workspaceName: string): string {
  const section = SECTION[route.name];
  const ws = workspaceName.trim();
  return ws ? `${section} · ${ws}` : section;
}
