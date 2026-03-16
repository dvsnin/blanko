import type { TeamRole } from "../types";

export const VALID_ROLES: ReadonlySet<TeamRole> = new Set<TeamRole>([
  "owner",
  "admin",
  "member",
]);

export const TEAM_ROLES = {
  OWNER: "owner" as const,
  ADMIN: "admin" as const,
  MEMBER: "member" as const,
};
