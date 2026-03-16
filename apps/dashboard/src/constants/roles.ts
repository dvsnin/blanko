import type { TeamRole } from "../types";

export const VALID_ROLES: ReadonlySet<TeamRole> = new Set<TeamRole>([
  "owner",
  "admin",
  "member",
]);
