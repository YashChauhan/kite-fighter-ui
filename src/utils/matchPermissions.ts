import type { Player, Match, UserRole } from "../types";
import { isUserClubOwnerOrCoOwner } from "./clubPermissions";

/**
 * Check if a user can manage the roster for a match.
 * Returns true if the user is:
 * - The match organizer
 * - A team captain
 * - Owner or co-owner of any involved club
 * - An admin
 */
export const canManageRoster = async (
  user: Player | null,
  match: Match,
): Promise<boolean> => {
  if (!user) return false;

  const userId = user._id || user.id;

  // Admin can always manage roster
  if (user.role === ("admin" as UserRole)) {
    return true;
  }

  // Check if user is the match organizer
  const organizerId =
    typeof match.organizerId === "string"
      ? match.organizerId
      : match.organizerId?._id || match.organizerId?.id;

  if (organizerId === userId) {
    return true;
  }

  // Check if user is a team captain
  for (const team of match.teams) {
    const captainId =
      typeof team.captain?.playerId === "string"
        ? team.captain.playerId
        : (team.captain?.playerId as Player)?._id ||
          (team.captain?.playerId as Player)?.id;

    if (captainId === userId) {
      return true;
    }
  }

  // Check if user is owner/co-owner of any involved club
  if (match.involvedClubs && match.involvedClubs.length > 0) {
    const isClubOwner = await isUserClubOwnerOrCoOwner(user);
    if (isClubOwner) {
      return true;
    }
  }

  return false;
};

/**
 * Get the team ID for a captain in the match
 */
export const getCaptainTeamId = (
  match: Match,
  captainId: string,
): string | null => {
  for (const team of match.teams) {
    const teamCaptainId =
      typeof team.captain?.playerId === "string"
        ? team.captain.playerId
        : (team.captain?.playerId as Player)?._id ||
          (team.captain?.playerId as Player)?.id;

    if (teamCaptainId === captainId) {
      return team.teamId;
    }
  }
  return null;
};

/**
 * Check if a player is already in the match (in either team)
 */
export const isPlayerInMatch = (match: Match, playerId: string): boolean => {
  for (const team of match.teams) {
    if (!team.players) continue;

    for (const player of team.players) {
      const pId =
        typeof player.playerId === "string"
          ? player.playerId
          : (player.playerId as Player)?._id || (player.playerId as Player)?.id;

      if (pId === playerId) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Get available players from a club that are not already in the match
 */
export const getAvailablePlayersForMatch = (
  clubPlayers: Player[],
  match: Match,
): Player[] => {
  return clubPlayers.filter((player) => {
    const playerId = player._id || player.id;
    return !isPlayerInMatch(match, playerId);
  });
};
