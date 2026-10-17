import { describe, it, expect } from 'vitest';
import { boardFromDTO, mapBoards, teamFromDTO } from './TeamsContext';
import { colorForId } from '../utils/cover';

const dto = { id: 'b-42', publicId: 'p', name: 'Доска', teamId: 't', ownerId: 'u', ownerName: 'Анна', teamAccess: 'edit' as const, templateId: '', linkAccessEnabled: false, isStarred: false, createdAt: '2026-10-17T10:00:00Z', updatedAt: '2026-10-17T10:00:00Z' };

describe('цвет доски', () => {
  it('mapBoards даёт colorKey по id', () => expect(mapBoards([dto])[0].colorKey).toBe(colorForId('b-42')));
  it('boardFromDTO без явного цвета тоже даёт цвет по id', () => expect(boardFromDTO(dto).colorKey).toBe(colorForId('b-42')));
});

describe('новые поля', () => {
  it('templateId: пусто → undefined', () => {
    expect(boardFromDTO({ ...dto, templateId: '' }).templateId).toBeUndefined();
    expect(boardFromDTO({ ...dto, templateId: 'letter' }).templateId).toBe('letter');
  });
  const t = { id: 't', name: 'Группа', role: 'owner' as const, isStarred: false, boardCount: 0, createdAt: '', updatedAt: '' };
  it('ageGroup: пусто → undefined', () => {
    expect(teamFromDTO({ ...t, ageGroup: '' }).ageGroup).toBeUndefined();
    expect(teamFromDTO({ ...t, ageGroup: '4-5' }).ageGroup).toBe('4-5');
  });
});
