import type { CrewAssignment, DifficultyId, Mission, RoleId } from "@/types";

/**
 * PRESENTATION-ONLY availability filter. Consumes the mission config contract;
 * does not implement gameplay validation rules.
 */
export function missionAvailability(
  mission: Mission,
  difficulty: DifficultyId,
  playerCount: number,
): { available: boolean; reason?: string } {
  if (mission.comingSoon) return { available: false, reason: mission.comingSoon };
  if (!mission.supportedDifficulties.includes(difficulty)) {
    return { available: false, reason: mission.restrictions?.[difficulty] ?? `Not offered on ${difficulty}.` };
  }
  if (playerCount < mission.minPlayers) {
    return { available: false, reason: `Needs at least ${mission.minPlayers} players (lobby has ${playerCount}).` };
  }
  return { available: true };
}

export function roleCounts(assignments: CrewAssignment[]): Record<RoleId, number> {
  const c: Record<RoleId, number> = { leader: 0, specialist: 0, engineer: 0 };
  assignments.forEach((a) => { if (a.roleId) c[a.roleId]++; });
  return c;
}

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
