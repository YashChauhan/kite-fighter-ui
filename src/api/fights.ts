import apiClient from "./client";
import type { Fight } from "../types";
import { FightResult } from "../types";

export const getFights = async (params: {
  matchId?: string;
  playerId?: string;
  status?: string;
}): Promise<{ data: Fight[] }> => {
  const { matchId, playerId, status } = params;

  let url = "/fights";
  if (matchId) {
    url = `/fights/match/${matchId}`;
  }

  const response = await apiClient.get(url, {
    params: { playerId, status },
  });

  // Handle both response formats:
  // 1. Backend returns array directly: [{...}, {...}]
  // 2. Backend returns wrapped: { data: [{...}, {...}] }
  if (Array.isArray(response.data)) {
    console.log("✅ Fights API returned array directly");
    return { data: response.data };
  } else if (response.data?.data && Array.isArray(response.data.data)) {
    console.log("✅ Fights API returned wrapped data");
    return response.data;
  } else {
    console.error("❌ Unexpected fights API response:", response.data);
    return { data: [] };
  }
};

export const getFightById = async (id: string): Promise<Fight> => {
  const response = await apiClient.get<Fight>(`/fights/${id}`);
  return response.data;
};

export const reportFight = async (data: {
  matchId: string;
  reporterId: string;
  player1Id: string;
  player2Id: string;
  result: FightResult;
  resultNote?: string;
}): Promise<Fight> => {
  const response = await apiClient.post<Fight>("/fights", data);
  return response.data;
};

export const confirmFight = async (data: {
  fightId: string;
  captainId: string;
  agreedResult: FightResult;
  notes?: string;
}): Promise<Fight> => {
  const { fightId, captainId, agreedResult, notes } = data;
  const response = await apiClient.post<Fight>(`/fights/${fightId}/confirm`, {
    captainId,
    agreedResult,
    notes,
  });
  return response.data;
};
