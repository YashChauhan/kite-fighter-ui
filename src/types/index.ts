// Type definitions based on API documentation

export const ApprovalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type ApprovalStatus =
  (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const UserRole = {
  PLAYER: "player",
  ADMIN: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const MatchType = {
  COMPETITIVE: "competitive",
  TRAINING: "training",
} as const;
export type MatchType = (typeof MatchType)[keyof typeof MatchType];

export const MatchStatus = {
  PENDING_CAPTAIN_CONFIRMATION: "pending_captain_confirmation",
  PENDING_PARTICIPANTS: "pending_participants",
  READY_TO_START: "ready_to_start",
  READY: "ready_to_start", // Alias for ready_to_start
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  SCHEDULED: "pending_captain_confirmation", // Alias for compatibility
  LIVE: "active", // Alias for compatibility
  DISPUTED: "disputed" as any, // For dispute status
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const FightStatus = {
  PENDING_CAPTAIN_CONFIRMATION: "pending_captain_confirmation",
  CONFIRMED: "confirmed",
  DISPUTED: "disputed",
  ADMIN_RESOLVED: "admin_resolved",
} as const;
export type FightStatus = (typeof FightStatus)[keyof typeof FightStatus];

export const FightResult = {
  PLAYER1_WIN: "player1",
  PLAYER2_WIN: "player2",
  DRAW: "draw",
  TEAM1_WIN: "player1", // Alias for compatibility
  TEAM2_WIN: "player2", // Alias for compatibility
} as const;
export type FightResult = (typeof FightResult)[keyof typeof FightResult];

export const StarType = {
  GREEN: "GREEN",
  GOLDEN: "GOLDEN",
  RAINBOW: "RAINBOW",
  BRONZE: "GREEN", // Alias for compatibility
  SILVER: "GOLDEN", // Alias for compatibility
  GOLD: "RAINBOW", // Alias for compatibility
  PLATINUM: "RAINBOW", // Alias for compatibility
} as const;
export type StarType = (typeof StarType)[keyof typeof StarType];

export interface FightStats {
  training: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
  };
  competitive: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
  };
}

export interface CurrentStreak {
  count: number;
  type?: string;
  lastFightId?: string;
  lastMatchId?: string;
  lastTeamId?: string;
  active: boolean;
  currentTier: StarType | null;
}

export interface BestStreak {
  count: number;
  type?: string;
  achievedAt?: Date;
  matchId?: string;
}

export interface StarTrophy {
  starType: StarType;
  streakCount: number;
  awardedAt: string;
  matchId?: string;
}

export interface PlayerClubMembership {
  club: Club;
  role: ClubMemberRole;
  joinedAt: string;
}

export interface Player {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  status: ApprovalStatus;
  clubs: string[] | Club[] | PlayerClubMembership[];
  deletionRequested: boolean;
  rejectionReason?: string;
  fightStats: FightStats;
  currentStreak: CurrentStreak;
  bestStreak: BestStreak;
  starTrophies: StarTrophy[];
  createdAt: string;
  updatedAt: string;
}

export const ClubMemberRole = {
  OWNER: "owner",
  CO_OWNER: "co_owner",
  MEMBER: "member",
} as const;
export type ClubMemberRole =
  (typeof ClubMemberRole)[keyof typeof ClubMemberRole];

export const ClubJoinRequestStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;
export type ClubJoinRequestStatus =
  (typeof ClubJoinRequestStatus)[keyof typeof ClubJoinRequestStatus];

export interface ClubMember {
  playerId: string | Player;
  role: ClubMemberRole;
  joinedAt: string;
}

export interface ClubJoinRequest {
  playerId: string;
  playerName: string;
  playerEmail: string;
  requestedAt: string;
  status: ClubJoinRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface Club {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  foundedDate?: string;
  players: string[] | Player[];
  members?: ClubMember[];
  joinRequests?: ClubJoinRequest[];
  status: ApprovalStatus;
  deletionRequested: boolean;
  competitiveMatchStats: {
    matchesWon: number;
    matchesLost: number;
    matchesDraw: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MatchPlayer {
  playerId: Player | string;
  playerName: string;
  confirmationStatus: "pending" | "confirmed" | "declined";
  confirmedAt?: string;
  enteringStreak: number;
  currentStreak: number;
  currentTier: StarType | null;
  isCaptain?: boolean;
}

export interface Team {
  _id?: string;
  teamId: string;
  teamName: string;
  club?: Club;
  clubId?: string | Club;
  players?: MatchPlayer[];
  captain?: {
    playerId: Player | string;
    confirmationStatus: "pending" | "confirmed" | "declined";
    promotedFrom: string;
  };
}

export interface ResultDeclaration {
  captainId: string;
  teamId: string;
  declaredWinner: string;
  declaredAt: string;
  confirmationRound: 1 | 2;
}

export interface MatchResult {
  status: "pending" | "agreed" | "disputed" | "resolved";
  winningTeamId?: string;
  declarations: ResultDeclaration[];
  finalizedAt?: string;
}

export interface Match {
  id: string;
  _id?: string;
  name?: string;
  description?: string;
  organizerId?: Player | string;
  teams: [Team, Team];
  // Legacy support for old structure
  team1?: Team;
  team2?: Team;
  type: MatchType;
  matchType?: MatchType;
  status: MatchStatus;
  scheduledAt?: string;
  matchDate?: string;
  winnerTeam?: number;
  winner?: "team1" | "team2" | "draw";
  matchResult?: MatchResult;
  involvedClubs?: Club[];
  statistics?: any[];
  allParticipants?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaptainConfirmation {
  captainId: string;
  captainName: string;
  teamId: string;
  agreedResult: FightResult;
  confirmedAt: string;
  notes?: string;
  confirmationOrder: 1 | 2;
}

export interface Fight {
  id: string;
  _id?: string;
  matchId: string;
  matchType?: MatchType;
  reportedBy?: {
    playerId: string;
    playerName: string;
    reporterRole: "captain_primary" | "captain_secondary" | "player";
  };
  team1Player: Player;
  team2Player: Player;
  player1?:
    | Player
    | {
        playerId: string;
        playerName: string;
        teamId: string;
        teamName: string;
      };
  player2?:
    | Player
    | {
        playerId: string;
        playerName: string;
        teamId: string;
        teamName: string;
      };
  result: FightResult;
  proposedResult?: FightResult;
  winner: Player;
  status: FightStatus;
  captainConfirmations?: CaptainConfirmation[];
  disputeDetails?: {
    reason: string;
  };
  resultNote?: string;
  reportedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthResponse {
  message: string;
  data: {
    player: Player;
    token: string;
  };
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
}

export interface BulkOperationResponse<T = Match> {
  success: string[];
  failed: Array<{
    playerId: string;
    reason: string;
  }>;
  match?: T;
}
