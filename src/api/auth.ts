import apiClient from "./client";
import type { AuthResponse, Player } from "../types";

export const register = async (
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>("/auth/register", {
    name,
    email,
    password,
  });
  return response.data;
};

export const login = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>("/auth/login", {
    email,
    password,
  });
  return response.data;
};

export const getCurrentUser = async (populate?: boolean): Promise<{ data: Player }> => {
  const response = await apiClient.get<{ data: Player }>("/auth/me", {
    params: populate ? { populate: 'clubs' } : undefined,
  });
  return response.data;
};
};

export const logout = (): void => {
  localStorage.removeItem("token");
};
