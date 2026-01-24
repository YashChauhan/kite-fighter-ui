import apiClient from "./client";
import type { Match } from "../types";

export const getMatches = async (params?: {
  page?: number;
  limit?: number;
  clubId?: string;
  status?: string;
  participantId?: string;
}): Promise<{ data: Match[]; pagination: any }> => {
  const response = await apiClient.get("/matches", { params });
  return response.data;
};

export const getMatchById = async (id: string): Promise<Match> => {
  const response = await apiClient.get<Match>(`/matches/${id}`, {
    params: { populate: "players,clubs" },
  });
  return response.data;
};

export const createMatch = async (data: {
  team1: {
    name: string;
    clubId?: string;
    players: string[];
    captain: string;
  };
  team2: {
    name: string;
    clubId?: string;
    players: string[];
    captain: string;
  };
}): Promise<Match> => {
  const response = await apiClient.post<Match>("/matches", data);
  return response.data;
};

export const confirmParticipation = async (
  matchId: string,
  status: "confirmed" | "declined",
): Promise<Match> => {
  const response = await apiClient.patch<Match>(
    `/matches/${matchId}/confirm-participation`,
    { status },
  );
  return response.data;
};

export const startMatch = async (matchId: string): Promise<Match> => {
  const response = await apiClient.post<Match>(`/matches/${matchId}/start`);
  return response.data;
};

export const declareWinner = async (
  matchId: string,
  winner: "team1" | "team2" | "draw",
): Promise<Match> => {
  const response = await apiClient.post<Match>(
    `/matches/${matchId}/result/declare`,
    { winner },
  );
  return response.data;
};
