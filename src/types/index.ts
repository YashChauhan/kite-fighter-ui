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
  PENDING_CAPTAIN_CONFIRMATION: "PENDING_CAPTAIN_CONFIRMATION",
  PENDING_PARTICIPANTS: "PENDING_PARTICIPANTS",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  SCHEDULED: "PENDING_CAPTAIN_CONFIRMATION", // Alias for compatibility
  LIVE: "ACTIVE", // Alias for compatibility
  DISPUTED: "DISPUTED" as any, // For dispute status
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const FightStatus = {
  PENDING_CAPTAIN_CONFIRMATION: "PENDING_CAPTAIN_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  DISPUTED: "DISPUTED",
  ADMIN_RESOLVED: "ADMIN_RESOLVED",
} as const;
export type FightStatus = (typeof FightStatus)[keyof typeof FightStatus];

export const FightResult = {
  PLAYER1_WIN: "PLAYER1_WIN",
  PLAYER2_WIN: "PLAYER2_WIN",
  DRAW: "DRAW",
  TEAM1_WIN: "PLAYER1_WIN", // Alias for compatibility
  TEAM2_WIN: "PLAYER2_WIN", // Alias for compatibility
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

export interface Player {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  status: ApprovalStatus;
  clubs: string[] | Club[];
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

export interface Team {
  teamId: string;
  teamName: string;
  club: Club;
  clubId?: string;
  players: Player[];
  captain: Player;
}

export interface Match {
  id: string;
  _id?: string;
  team1: Team;
  team2: Team;
  type: MatchType;
  matchType?: MatchType;
  status: MatchStatus;
  scheduledAt: string;
  matchDate?: string;
  winnerTeam?: number;
  winner?: "team1" | "team2" | "draw";
  createdAt: string;
  updatedAt: string;
}

export interface Fight {
  id: string;
  _id?: string;
  matchId: string;
  team1Player: Player;
  team2Player: Player;
  player1?: Player;
  player2?: Player;
  result: FightResult;
  winner: Player;
  status: FightStatus;
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
