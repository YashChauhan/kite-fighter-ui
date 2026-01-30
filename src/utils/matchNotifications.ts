import type { Match, Player, MatchPlayer } from "../types";
import { MatchStatus } from "../types";

export interface MatchNotifications {
  needsCaptainConfirmation: boolean;
  needsPlayerConfirmation: boolean;
  canStart: boolean;
  hasPendingActions: boolean; // Generic pending actions for active matches
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
    hasPendingActions: false,
    totalPending: 0,
  };

  if (!userId || !match) return notifications;

  const teams = match.teams || [match.team1, match.team2].filter(Boolean);

  // Helper: Check if user is a captain
  const isUserCaptain = teams.some((team) => {
    if (!team?.captain) {
      console.log("🔍 No captain in team:", team);
      return false;
    }

    const captainId =
      typeof team.captain.playerId === "string"
        ? team.captain.playerId
        : team.captain.playerId?._id || team.captain.playerId?.id;

    console.log("🔍 Checking captain:", {
      teamId: team.teamId,
      captainId,
      userId,
      match: captainId === userId,
      captain: team.captain,
    });

    return captainId === userId;
  });

  console.log("🔍 Captain check result:", {
    matchId: match._id || match.id,
    matchName: match.name,
    matchStatus: match.status,
    isUserCaptain,
    userId,
    teamsCount: teams.length,
  });

  // Check captain confirmation needed
  if (match.status === MatchStatus.PENDING_CAPTAIN_CONFIRMATION) {
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

  // Check for active matches where user is a captain
  // (likely has pending fight confirmations)
  // Note: MatchStatus.LIVE === MatchStatus.ACTIVE === "active"
  if (match.status === "active" && isUserCaptain) {
    console.log("🔔 Notification detected:", {
      matchId: match._id || match.id,
      matchName: match.name,
      status: match.status,
      isUserCaptain,
      userId,
    });
    notifications.hasPendingActions = true;
    notifications.totalPending++;
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
  if (notifications.hasPendingActions) {
    return "Action Required";
  }
  if (notifications.totalPending > 0) {
    return `${notifications.totalPending} Pending`;
  }
  return null;
};
