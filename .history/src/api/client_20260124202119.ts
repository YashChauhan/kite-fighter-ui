import axios, { type AxiosInstance, AxiosError } from "axios";
import type { ApiError } from "../types";

// Environment-based API configuration
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || "development";

// Log environment info in development
if (ENVIRONMENT === "development") {
  console.log(`🚀 API Environment: ${ENVIRONMENT}`);
  console.log(`🔗 API Base URL: ${API_BASE_URL}`);
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");

      // Show notification
      const event = new CustomEvent("session-expired");
      window.dispatchEvent(event);

      // Redirect to login
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError;

    // Map common error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      VALIDATION_ERROR: "Please check your input and try again",
      INVALID_ID: "Invalid ID provided",
      UNAUTHORIZED: "Please log in to continue",
      NOT_FOUND: "Resource not found",
      DUPLICATE_ERROR: "This item already exists",
      INTERNAL_SERVER_ERROR: "Something went wrong. Please try again",
      RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later",
    };

    return (
      errorMessages[apiError?.code] || apiError?.message || "An error occurred"
    );
  }

  return "An unexpected error occurred";
};

export default apiClient;
