import apiClient from "./client";
import type { Player, Club } from "../types";

export const getPendingPlayers = async (): Promise<{ data: Player[] }> => {
  const response = await apiClient.get("/admin/players/pending");
  return response.data;
};

export const approvePlayer = async (playerId: string): Promise<Player> => {
  const response = await apiClient.post<Player>(
    `/admin/players/${playerId}/approve`,
  );
  return response.data;
};

export const rejectPlayer = async (
  playerId: string,
  reason: string,
): Promise<Player> => {
  const response = await apiClient.post<Player>(
    `/admin/players/${playerId}/reject`,
    { reason },
  );
  return response.data;
};

export const getPendingClubs = async (): Promise<{ data: Club[] }> => {
  const response = await apiClient.get("/admin/clubs/pending");
  return response.data;
};

export const approveClub = async (clubId: string): Promise<Club> => {
  const response = await apiClient.post<Club>(`/admin/clubs/${clubId}/approve`);
  return response.data;
};

export const rejectClub = async (
  clubId: string,
  reason: string,
): Promise<Club> => {
  const response = await apiClient.post<Club>(`/admin/clubs/${clubId}/reject`, {
    reason,
  });
  return response.data;
};

export const resolveFightDispute = async (
  fightId: string,
  finalResult: string,
): Promise<any> => {
  const response = await apiClient.post(`/admin/fights/${fightId}/resolve`, {
    finalResult,
  });
  return response.data;
};

export const resolveMatchDispute = async (
  matchId: string,
  finalWinner: string,
): Promise<any> => {
  const response = await apiClient.post(
    `/admin/matches/${matchId}/result/resolve`,
    { finalWinner },
  );
  return response.data;
};
