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
  return response.data;
};

export const getFightById = async (id: string): Promise<Fight> => {
  const response = await apiClient.get<Fight>(`/fights/${id}`);
  return response.data;
};

export const reportFight = async (data: {
  matchId: string;
  player1: string;
  player2: string;
  result: FightResult;
}): Promise<Fight> => {
  const response = await apiClient.post<Fight>("/fights", data);
  return response.data;
};

export const confirmFight = async (
  fightId: string,
  decision: "accept" | "dispute",
): Promise<Fight> => {
  const response = await apiClient.post<Fight>(`/fights/${fightId}/confirm`, {
    decision,
  });
  return response.data;
};
