import type { BoardDTO, BoardPage, TeamDTO } from "../api/client";

export const teamDTOs: TeamDTO[] = [
  { id: "t1", name: "Солнышко", role: "owner", isStarred: false, boardCount: 1, recentBoards: [], memberBoardAccess: "edit", ageGroup: "", teachers: "", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "t2", name: "Ромашка", role: "member", isStarred: false, boardCount: 0, recentBoards: [], memberBoardAccess: "edit", ageGroup: "", teachers: "", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
];

/** Страница списка досок, как её отдаёт /board/list. */
export function page(items: BoardDTO[], total = items.length, nextCursor = ""): BoardPage {
  return { items, total, nextCursor };
}

export function boardDTO(id: string, teamId: string, name: string): BoardDTO {
  return {
    id, publicId: "p-" + id, name, teamId, ownerId: "u1", ownerName: "Анна",
    teamAccess: "edit", teamAccessInherited: true, linkAccessEnabled: false, isStarred: false, canEdit: true, templateId: "",
    createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", lastOpenedAt: "2026-10-02T00:00:00Z",
  };
}

export const firstBoard = boardDTO("b1", "t1", "Первая");
teamDTOs[0].recentBoards = [firstBoard];
