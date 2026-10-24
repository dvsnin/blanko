import type { BoardDTO, TeamDTO } from "../api/client";

export const teamDTOs: TeamDTO[] = [
  { id: "t1", name: "Солнышко", role: "owner", isStarred: false, boardCount: 1, ageGroup: "", teachers: "", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "t2", name: "Ромашка", role: "member", isStarred: false, boardCount: 0, ageGroup: "", teachers: "", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
];

export function boardDTO(id: string, teamId: string, name: string): BoardDTO {
  return {
    id, publicId: "p-" + id, name, teamId, ownerId: "u1", ownerName: "Анна",
    teamAccess: "edit", linkAccessEnabled: false, isStarred: false, canEdit: true, hasPreview: false, templateId: "",
    createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", lastOpenedAt: "2026-10-02T00:00:00Z",
  };
}

export const firstBoard = boardDTO("b1", "t1", "Первая");
