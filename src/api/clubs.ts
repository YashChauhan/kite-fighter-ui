import apiClient from "./client";
import type { Club, PaginatedResponse } from "../types";

export const getClubs = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<PaginatedResponse<Club>> => {
  const response = await apiClient.get<PaginatedResponse<Club>>("/clubs", {
    params,
  });
  return response.data;
};

export const getClubById = async (
  id: string,
  populate?: boolean,
): Promise<Club> => {
  const response = await apiClient.get<Club>(`/clubs/${id}`, {
    params: populate ? { populate: "players" } : undefined,
  });
  return response.data;
};

export const getClubPlayers = async (id: string): Promise<{ data: any[] }> => {
  const response = await apiClient.get(`/clubs/${id}/players`);
  return response.data;
};

export const createClub = async (data: {
  name: string;
  description?: string;
  foundedDate?: string;
  ownerId: string;
  players?: string[];
}): Promise<Club> => {
  const response = await apiClient.post<Club>("/clubs", data);
  return response.data;
};

export const updateClub = async (
  id: string,
  data: {
    name?: string;
    description?: string;
  },
): Promise<Club> => {
  const response = await apiClient.put<Club>(`/clubs/${id}`, data);
  return response.data;
};

export const getClubMembers = async (
  clubId: string,
): Promise<
  Array<{
    playerId: {
      _id: string;
      name: string;
      email: string;
    };
    role: "owner" | "co_owner" | "member";
    joinedAt: string;
  }>
> => {
  const response = await apiClient.get(`/clubs/${clubId}/members`);
  return response.data;
};

export const requestJoinClub = async (
  clubId: string,
  message?: string,
): Promise<{ message: string; club: Club }> => {
  const response = await apiClient.post(`/membership/join-request`, {
    clubId,
    message,
  });
  return response.data;
};

export const cancelJoinRequest = async (
  clubId: string,
): Promise<{ message: string; club: Club }> => {
  const response = await apiClient.delete(`/clubs/${clubId}/join-request`);
  return response.data;
};

export const leaveClub = async (
  clubId: string,
): Promise<{ message: string; club: Club }> => {
  const response = await apiClient.post(`/clubs/${clubId}/leave`);
  return response.data;
};

export const getPendingJoinRequests = async (
  clubId: string,
): Promise<
  Array<{
    playerId: string;
    playerName: string;
    playerEmail: string;
    requestedAt: string;
    status: string;
  }>
> => {
  const response = await apiClient.get(`/clubs/${clubId}/join-requests`);
  return response.data;
};

export const reviewJoinRequest = async (
  clubId: string,
  playerId: string,
  approved: boolean,
  rejectionReason?: string,
): Promise<{ message: string; club: Club }> => {
  const response = await apiClient.post(
    `/clubs/${clubId}/join-request/review`,
    {
      playerId,
      approved,
      rejectionReason,
    },
  );
  return response.data;
};

export const updateMemberRole = async (
  clubId: string,
  playerId: string,
  role: "owner" | "co_owner" | "member",
): Promise<{ message: string; member: any }> => {
  const response = await apiClient.patch(`/clubs/${clubId}/members/role`, {
    playerId,
    role,
  });
  return response.data;
};
