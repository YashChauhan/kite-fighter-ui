import apiClient, { formatError } from "./client";
import type { Match, BulkOperationResponse } from "../types";

export const getMatches = async (params?: {
  page?: number;
  limit?: number;
  clubId?: string;
  status?: string;
  participantId?: string;
  populate?: string;
}): Promise<{ data: Match[]; pagination: any }> => {
  const response = await apiClient.get("/matches", { params });
  return response.data;
};

export const getMatchById = async (id: string): Promise<Match> => {
  const response = await apiClient.get<Match>(`/matches/${id}`, {
    params: { populate: "players,clubs" },
  });
  console.log("🔍 getMatchById API response:", response);
  console.log("🔍 getMatchById response.data:", response.data);
  return response.data;
};

export const createMatch = async (data: {
  name: string;
  matchDate: string;
  organizerId: string;
  description?: string;
  team1: {
    teamName: string;
    captainId: string;
    clubId: string;
  };
  team2: {
    teamName: string;
    captainId: string;
    clubId: string;
  };
  location?: {
    name: string;
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  rules?: {
    matchDuration?: number;
    maxFighters?: number;
    eliminationType?: string;
  };
}): Promise<Match> => {
  const response = await apiClient.post<Match>("/matches", data);
  return response.data;
};

export const confirmParticipation = async (
  matchId: string,
  playerId: string,
): Promise<Match> => {
  const response = await apiClient.patch<Match>(
    `/matches/${matchId}/confirm-participation`,
    { playerId },
  );
  return response.data;
};

export const declineParticipation = async (
  matchId: string,
  playerId: string,
  reason?: string,
): Promise<Match> => {
  const response = await apiClient.patch<Match>(
    `/matches/${matchId}/decline-participation`,
    { playerId, reason },
  );
  return response.data;
};

export const startMatch = async (
  matchId: string,
  initiatorId: string,
): Promise<Match> => {
  const response = await apiClient.post<Match>(`/matches/${matchId}/start`, {
    initiatorId,
  });
  return response.data;
};

export const declareWinner = async (data: {
  matchId: string;
  captainId: string;
  winningTeamId: string;
  confirmationRound?: number;
}): Promise<Match> => {
  const { matchId, captainId, winningTeamId, confirmationRound } = data;
  const response = await apiClient.post<Match>(
    `/matches/${matchId}/result/declare`,
    { captainId, winningTeamId, confirmationRound },
  );
  return response.data;
};

// Roster Management APIs

export const addPlayersToTeam = async (
  matchId: string,
  teamId: string,
  playerIds: string[],
): Promise<BulkOperationResponse> => {
  try {
    const response = await apiClient.post<BulkOperationResponse>(
      `/matches/${matchId}/teams/${teamId}/players/bulk`,
      { playerIds },
    );
    return response.data;
  } catch (error) {
    throw new Error(formatError(error));
  }
};

export const removePlayersFromTeam = async (
  matchId: string,
  teamId: string,
  playerIds: string[],
): Promise<BulkOperationResponse> => {
  try {
    const response = await apiClient.delete<BulkOperationResponse>(
      `/matches/${matchId}/teams/${teamId}/players/bulk`,
      { data: { playerIds } },
    );
    return response.data;
  } catch (error) {
    throw new Error(formatError(error));
  }
};

export const changeCaptain = async (
  matchId: string,
  teamId: string,
  captainId: string,
): Promise<Match> => {
  try {
    const response = await apiClient.patch<Match>(
      `/matches/${matchId}/teams/${teamId}/captain`,
      { captainId },
    );
    return response.data;
  } catch (error) {
    throw new Error(formatError(error));
  }
};
