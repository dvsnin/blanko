import type { Template } from '../types';

/* Фикстура шаблонов для тестов. */

export const tpl = (over: Partial<Template> & { id: string; name: string }): Template => ({
  publicId: 'p-' + over.id, description: '', topic: 'math', ages: ['3-4'], durationMin: 20,
  source: 'preset', isStarred: false, canEdit: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  ...over,
});

export const FIXTURE: Template[] = [
  tpl({ id: 't1', name: 'Счёт до 5 с яблоками', topic: 'math', ages: ['3-4'], glyph: '5', description: 'яблоки в корзину' }),
  tpl({ id: 't2', name: 'Буква и слова на неё', topic: 'literacy', ages: ['4-5'], source: 'own', authorId: 'u1', authorName: 'Анна Петрова', canEdit: true }),
  tpl({ id: 't3', name: 'Времена года', topic: 'world', ages: ['3-4', '4-5', '5-6', '6-7'], isStarred: true }),
  tpl({ id: 't4', name: 'Что лишнее', topic: 'logic', ages: ['6-7'], durationMin: 15 }),
];
