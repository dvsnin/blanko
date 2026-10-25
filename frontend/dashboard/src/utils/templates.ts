import { AGES, TOPICS, type AgeKey, type TopicKey, type TopicStyle } from "../constants/templates";
import { coverFor, glyphFromTitle, type Cover } from "./cover";
import type { Template } from "../types";

export function topicStyle(key: TopicKey): TopicStyle {
  return TOPICS.find((t) => t.key === key) ?? TOPICS[0];
}

export function ageLabel(key?: AgeKey): string | undefined {
  return AGES.find((a) => a.key === key)?.label;
}

export function templateGlyph(t: Template): string {
  return t.glyph || glyphFromTitle(t.name);
}

function matchesQuery(t: Template, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${t.name} ${t.description} ${topicStyle(t.topic).label} ${t.authorName ?? ""}`
    .toLowerCase()
    .includes(needle);
}

export function filterTemplates(list: Template[], q: string, age: AgeKey | "all", topic: TopicKey | "all"): Template[] {
  return list.filter(
    (t) =>
      matchesQuery(t, q) &&
      (age === "all" || t.ages.includes(age)) &&
      (topic === "all" || t.topic === topic),
  );
}

export function topicCounts(list: Template[], q: string, age: AgeKey | "all"): Record<TopicKey | "all", number> {
  const counts = { all: 0 } as Record<TopicKey | "all", number>;
  for (const t of TOPICS) counts[t.key] = 0;
  for (const t of filterTemplates(list, q, age, "all")) {
    counts.all += 1;
    counts[t.topic] += 1;
  }
  return counts;
}

/** Обложка доски плюс тема шаблона, если он передан. Буква всегда из названия доски:
    глиф шаблона на карточках досок не показываем. */
export function coverForBoard(
  board: { id: string; title: string; templateId?: string; colorKey?: string },
  template?: Template,
): Cover & { topic?: TopicStyle } {
  const base = coverFor(board);
  if (!template) return base;
  return { ...base, topic: topicStyle(template.topic) };
}
