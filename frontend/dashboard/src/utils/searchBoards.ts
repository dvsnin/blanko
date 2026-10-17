import type { Board, Team } from '../types';

export type Segment = 'all' | 'mine' | 'starred';

/** Подстрока без учёта регистра; пустой запрос подходит всем. */
export function matchesQuery(title: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  return !needle || title.toLowerCase().includes(needle);
}

/** Доски других групп, подходящие под запрос. Пустой запрос -> []. */
export function searchOtherTeams(
  teams: Team[],
  activeTeamId: string | null,
  q: string,
): Array<{ board: Board; team: Team }> {
  if (!q.trim()) return [];
  const out: Array<{ board: Board; team: Team }> = [];
  for (const team of teams) {
    if (team.id === activeTeamId) continue;
    for (const board of team.boards) {
      if (matchesQuery(board.title, q)) out.push({ board, team });
    }
  }
  return out;
}
