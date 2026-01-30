import type { Match, Player, MatchPlayer } from "../types";
import { MatchStatus } from "../types";

export interface MatchNotifications {
  needsCaptainConfirmation: boolean;
  needsPlayerConfirmation: boolean;
  canStart: boolean;
  totalPending: number;
}

/**
 * Calculate notification indicators for a match based on user's role
 */
export const getMatchNotifications = (
  match: Match,
  userId?: string,
): MatchNotifications => {
  const notifications: MatchNotifications = {
    needsCaptainConfirmation: false,
    needsPlayerConfirmation: false,
    canStart: false,
    totalPending: 0,
  };

  if (!userId || !match) return notifications;

  // Check captain confirmation needed
  if (match.status === MatchStatus.PENDING_CAPTAIN_CONFIRMATION) {
    const teams = match.teams || [match.team1, match.team2].filter(Boolean);

    teams.forEach((team) => {
      if (!team?.captain) return;

      const captainId =
        typeof team.captain.playerId === "string"
          ? team.captain.playerId
          : team.captain.playerId?._id || team.captain.playerId?.id;

      if (
        captainId === userId &&
        team.captain.confirmationStatus === "pending"
      ) {
        notifications.needsCaptainConfirmation = true;
        notifications.totalPending++;
      }
    });
  }

  // Check player participation confirmation
  if (
    match.status === MatchStatus.PENDING_PARTICIPANTS ||
    match.status === MatchStatus.PENDING_CAPTAIN_CONFIRMATION
  ) {
    const teams = match.teams || [match.team1, match.team2].filter(Boolean);

    teams.forEach((team) => {
      if (!team?.players) return;

      team.players.forEach((player: MatchPlayer) => {
        const playerId =
          typeof player.playerId === "string"
            ? player.playerId
            : (player.playerId as Player)?._id ||
              (player.playerId as Player)?.id;

        if (playerId === userId && player.confirmationStatus === "pending") {
          notifications.needsPlayerConfirmation = true;
          notifications.totalPending++;
        }
      });
    });
  }

  // Check if user can start match
  if (match.status === MatchStatus.READY_TO_START) {
    const teams = match.teams || [match.team1, match.team2].filter(Boolean);

    teams.forEach((team) => {
      if (!team?.captain) return;

      const captainId =
        typeof team.captain.playerId === "string"
          ? team.captain.playerId
          : team.captain.playerId?._id || team.captain.playerId?.id;

      if (captainId === userId) {
        notifications.canStart = true;
      }
    });
  }

  return notifications;
};

/**
 * Get a user-friendly label for pending actions
 */
export const getNotificationLabel = (
  notifications: MatchNotifications,
): string | null => {
  if (notifications.needsCaptainConfirmation) {
    return "Confirm as Captain";
  }
  if (notifications.needsPlayerConfirmation) {
    return "Confirm Participation";
  }
  if (notifications.canStart) {
    return "Ready to Start";
  }
  if (notifications.totalPending > 0) {
    return `${notifications.totalPending} Pending`;
  }
  return null;
};
