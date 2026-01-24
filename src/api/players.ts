import apiClient from "./client";
import type { Player, PaginatedResponse } from "../types";

export const getPlayers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  clubId?: string;
  sort?: string;
}): Promise<PaginatedResponse<Player>> => {
  const response = await apiClient.get<PaginatedResponse<Player>>("/players", {
    params,
  });
  return response.data;
};

export const getPlayerById = async (
  id: string,
  populate?: boolean,
): Promise<Player> => {
  const response = await apiClient.get<Player>(`/players/${id}`, {
    params: populate ? { populate: "clubs" } : undefined,
  });
  return response.data;
};

export const updatePlayer = async (
  id: string,
  data: { name?: string; email?: string },
): Promise<Player> => {
  const response = await apiClient.put<Player>(`/players/${id}`, data);
  return response.data;
};

export const joinClub = async (
  playerId: string,
  clubId: string,
): Promise<Player> => {
  const response = await apiClient.patch<Player>(
    `/players/${playerId}/join-club`,
    { clubId },
  );
  return response.data;
};

export const leaveClub = async (
  playerId: string,
  clubId: string,
): Promise<Player> => {
  const response = await apiClient.patch<Player>(
    `/players/${playerId}/leave-club`,
    { clubId },
  );
  return response.data;
};

export const requestDeletion = async (playerId: string): Promise<void> => {
  await apiClient.delete(`/players/${playerId}`);
};
