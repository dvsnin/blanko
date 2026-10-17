import {
  AGES, TEMPLATES, TOPICS,
  type AgeKey, type Template, type TopicKey, type TopicStyle,
} from "../constants/templates";
import { coverFor, type Cover } from "./cover";

export function templatesForAge(age?: AgeKey, limit = 5): Template[] {
  const list = age ? TEMPLATES.filter((t) => t.ages.includes(age)) : TEMPLATES;
  return list.slice(0, limit);
}

function matchesQuery(t: Template, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${t.title} ${t.desc} ${topicStyle(t.topic).label}`.toLowerCase().includes(needle);
}

export function filterTemplates(q: string, age: AgeKey | "all", topic: TopicKey | "all"): Template[] {
  return TEMPLATES.filter(
    (t) =>
      matchesQuery(t, q) &&
      (age === "all" || t.ages.includes(age)) &&
      (topic === "all" || t.topic === topic),
  );
}

export function topicCounts(q: string, age: AgeKey | "all"): Record<TopicKey | "all", number> {
  const counts = { all: 0 } as Record<TopicKey | "all", number>;
  for (const t of TOPICS) counts[t.key] = 0;
  for (const t of filterTemplates(q, age, "all")) {
    counts.all += 1;
    counts[t.topic] += 1;
  }
  return counts;
}

export function templateById(id?: string | null): Template | undefined {
  if (!id) return undefined;
  return TEMPLATES.find((t) => t.id === id);
}

export function topicStyle(key: TopicKey): TopicStyle {
  return TOPICS.find((t) => t.key === key) ?? TOPICS[0];
}

export function ageLabel(key?: AgeKey): string | undefined {
  return AGES.find((a) => a.key === key)?.label;
}

/** Обложка доски: базовая coverFor, а глиф и тема берутся из шаблона, если он известен. */
export function coverForBoard(board: { id: string; title: string; templateId?: string }): Cover & { topic?: TopicStyle } {
  const base = coverFor(board);
  const tpl = templateById(board.templateId);
  if (!tpl) return base;
  return { ...base, glyph: tpl.glyph, topic: topicStyle(tpl.topic) };
}
