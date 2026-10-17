import { describe, it, expect } from 'vitest';
import { boardFromDTO, mapBoards } from './TeamsContext';
import { colorForId } from '../utils/cover';

const dto = { id: 'b-42', publicId: 'p', name: 'Доска', teamId: 't', ownerId: 'u', ownerName: 'Анна', teamAccess: 'edit' as const, linkAccessEnabled: false, isStarred: false, createdAt: '2026-10-17T10:00:00Z', updatedAt: '2026-10-17T10:00:00Z' };

describe('цвет доски', () => {
  it('mapBoards даёт colorKey по id', () => expect(mapBoards([dto])[0].colorKey).toBe(colorForId('b-42')));
  it('boardFromDTO без явного цвета тоже даёт цвет по id', () => expect(boardFromDTO(dto).colorKey).toBe(colorForId('b-42')));
});
