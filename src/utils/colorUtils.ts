/**
 * Centralized color utilities for consistent theming across the application
 */

import { MatchType, ApprovalStatus, UserRole } from "../types";

export type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "error"
  | "info"
  | "success"
  | "warning";

/**
 * Get color for match status
 */
export const getMatchStatusColor = (status: string): ChipColor => {
  const statusLower = status?.toLowerCase() || "";

  if (statusLower.includes("pending") || statusLower.includes("confirmation")) {
    return "warning"; // Orange for pending states
  }
  if (statusLower === "ready" || statusLower === "ready_to_start") {
    return "info"; // Blue for ready
  }
  if (statusLower === "active" || statusLower === "live") {
    return "success"; // Green for active/live
  }
  if (statusLower === "completed") {
    return "success"; // Green for completed
  }
  if (statusLower === "cancelled") {
    return "error"; // Red for cancelled
  }
  return "default";
};

/**
 * Get formatted label for match status
 */
export const getMatchStatusLabel = (status: string): string => {
  const statusLower = status?.toLowerCase() || "";

  if (statusLower.includes("pending") && statusLower.includes("captain")) {
    return "Pending Confirmation";
  }
  if (statusLower.includes("pending") && statusLower.includes("participants")) {
    return "Pending Participants";
  }
  if (statusLower === "ready" || statusLower === "ready_to_start") {
    return "Ready";
  }
  if (statusLower === "active" || statusLower === "live") {
    return "Live";
  }
  if (statusLower === "completed") {
    return "Completed";
  }
  if (statusLower === "cancelled") {
    return "Cancelled";
  }
  // Return capitalized version if no match
  return status.charAt(0).toUpperCase() + status.slice(1);
};

/**
 * Get color for match type
 */
export const getMatchTypeColor = (type: MatchType): ChipColor => {
  return type === MatchType.COMPETITIVE ? "secondary" : "primary";
};

/**
 * Get formatted label for match type
 */
export const getMatchTypeLabel = (type: MatchType): string => {
  return type === MatchType.TRAINING ? "Training" : "Competitive";
};

/**
 * Get color for approval status
 */
export const getApprovalStatusColor = (status: ApprovalStatus): ChipColor => {
  switch (status) {
    case ApprovalStatus.APPROVED:
      return "success";
    case ApprovalStatus.PENDING:
      return "warning";
    case ApprovalStatus.REJECTED:
      return "error";
    default:
      return "default";
  }
};

/**
 * Get formatted label for approval status
 */
export const getApprovalStatusLabel = (status: ApprovalStatus): string => {
  switch (status) {
    case ApprovalStatus.APPROVED:
      return "Approved";
    case ApprovalStatus.PENDING:
      return "Pending Approval";
    case ApprovalStatus.REJECTED:
      return "Rejected";
    default:
      return status;
  }
};

/**
 * Get color for user role
 */
export const getUserRoleColor = (role: UserRole): ChipColor => {
  return role === UserRole.ADMIN ? "secondary" : "primary";
};

/**
 * Get formatted label for user role
 */
export const getUserRoleLabel = (role: UserRole): string => {
  return role?.toUpperCase() || "PLAYER";
};

/**
 * Get color for club role
 */
export const getClubRoleColor = (role: string): ChipColor => {
  switch (role) {
    case "owner":
      return "warning"; // Orange
    case "co_owner":
      return "info"; // Blue
    default:
      return "default";
  }
};

/**
 * Get formatted label for club role
 */
export const getClubRoleLabel = (role: string): string => {
  switch (role) {
    case "owner":
      return "CLUB OWNER";
    case "co_owner":
      return "CLUB CO-OWNER";
    case "member":
      return "MEMBER";
    default:
      return role.toUpperCase();
  }
};
