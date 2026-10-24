import { useVisibleRefresh } from "./TeamsContext";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, type TemplateDTO } from "../api/client";
import type { AgeKey, TopicKey } from "../constants/templates";
import type { Template, TemplateInput } from "../types";
import { insertAfter } from "../utils/insertAfter";

/* Шаблоны из /template/list. Без провайдера (в тестах) - пустой список и no-op. */

export interface TemplatesContextValue {
  templates: Template[];
  loading: boolean;
  error: string | null;
  byId: (id?: string) => Template | undefined;
  createTemplate: (input: TemplateInput, fromBoardId?: string) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<TemplateInput>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<Template>;
  toggleStarTemplate: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function templateFromDTO(dto: TemplateDTO): Template {
  return {
    id: dto.id,
    publicId: dto.publicId,
    name: dto.name,
    description: dto.description ?? "",
    topic: dto.topic as TopicKey,
    ages: (dto.ages ?? []) as AgeKey[],
    durationMin: dto.durationMin,
    glyph: dto.glyph || undefined,
    source: dto.source,
    authorId: dto.authorId || undefined,
    authorName: dto.authorName || undefined,
    isStarred: dto.isStarred,
    canEdit: dto.canEdit,
    hasPreview: dto.hasPreview,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

const noop = async () => { throw new Error("TemplatesProvider is missing"); };

export const EMPTY_TEMPLATES: TemplatesContextValue = {
  templates: [],
  loading: false,
  error: null,
  byId: () => undefined,
  createTemplate: noop,
  updateTemplate: noop,
  deleteTemplate: noop,
  duplicateTemplate: noop,
  toggleStarTemplate: noop,
  refresh: async () => {},
};

export const TemplatesContext = createContext<TemplatesContextValue>(EMPTY_TEMPLATES);

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api.templates.list();
      setTemplates(items.map(templateFromDTO));
    } catch (e) {
      console.error("load templates failed:", e);
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useVisibleRefresh(refresh);

  const index = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const byId = useCallback((id?: string) => (id ? index.get(id) : undefined), [index]);

  const createTemplate = useCallback(async (input: TemplateInput, fromBoardId?: string) => {
    const dto = await api.templates.create(input, fromBoardId);
    const t = templateFromDTO(dto);
    setTemplates((prev) => [...prev, t]);
    return t;
  }, []);

  const updateTemplate = useCallback(async (id: string, patch: Partial<TemplateInput>) => {
    const dto = await api.templates.update(id, patch);
    const t = templateFromDTO(dto);
    setTemplates((prev) => prev.map((x) => (x.id === id ? t : x)));
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    await api.templates.delete(id);
    setTemplates((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // Копия встаёт сразу после исходного шаблона.
  const duplicateTemplate = useCallback(async (id: string) => {
    const dto = await api.templates.duplicate(id);
    const t = templateFromDTO(dto);
    setTemplates((prev) => insertAfter(prev, id, t));
    return t;
  }, []);

  const toggleStarTemplate = useCallback(async (id: string) => {
    const current = index.get(id);
    if (!current) return;
    const next = !current.isStarred;
    setTemplates((prev) => prev.map((x) => (x.id === id ? { ...x, isStarred: next } : x)));
    try {
      if (next) await api.templates.star(id);
      else await api.templates.unstar(id);
    } catch (e) {
      console.error("toggleStarTemplate failed:", e);
      setTemplates((prev) => prev.map((x) => (x.id === id ? { ...x, isStarred: !next } : x)));
    }
  }, [index]);

  const value = useMemo<TemplatesContextValue>(
    () => ({ templates, loading, error, byId, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, toggleStarTemplate, refresh }),
    [templates, loading, error, byId, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, toggleStarTemplate, refresh],
  );

  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
}

export function useTemplates(): TemplatesContextValue {
  return useContext(TemplatesContext);
}
