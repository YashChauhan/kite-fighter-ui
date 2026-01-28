import type { Player } from "../types";
import { getClubMembers } from "../api/clubs";

/**
 * Gets the user's role in a specific club
 * First checks if user.clubs is populated with role info, then falls back to API call
 */
export const getUserClubRole = async (
  user: Player | null,
  clubId: string,
): Promise<"owner" | "co_owner" | "member" | null> => {
  if (!user || !Array.isArray(user.clubs) || user.clubs.length === 0) {
    console.log("❌ No user or clubs array:", {
      user: !!user,
      clubs: user?.clubs,
    });
    return null;
  }

  const firstClub = user.clubs[0];
  console.log("📋 First club structure:", firstClub);

  // Check if clubs are populated with role info (PlayerClubMembership[])
  if (
    typeof firstClub === "object" &&
    "role" in firstClub &&
    "club" in firstClub
  ) {
    const membership = user.clubs.find((m: any) => {
      const memberClubId = m.club._id || m.club.id;
      console.log("🔍 Checking membership for club:", {
        memberClubId,
        clubId,
        role: m.role,
      });
      return memberClubId === clubId;
    });
    console.log("✅ Found membership:", membership);
    return (membership as any)?.role || null;
  }

  // Fallback: clubs are just Club objects without role, need to fetch from members API
  console.log(`🔄 Fetching role from members API for club: ${clubId}`);
  try {
    const members = await getClubMembers(clubId);
    console.log(`📊 Members response for club ${clubId}:`, members);
    const userId = user._id || user.id;
    console.log(`🔍 Looking for user ID: ${userId}`);

    const userMember = members.find((m) => {
      // API returns playerId as a string
      console.log(`   Comparing: "${m.playerId}" === "${userId}"`);
      return m.playerId === userId;
    });

    console.log(`👤 User member found:`, userMember);
    console.log(`🎭 User role:`, userMember?.role);
    return userMember?.role || null;
  } catch (err) {
    console.error("❌ Failed to get club members:", err);
    return null;
  }
};

/**
 * Checks if user is owner or co-owner of any club
 * Uses the populated user.clubs array for better performance
 */
export const isUserClubOwnerOrCoOwner = async (
  user: Player | null,
): Promise<boolean> => {
  if (!user || !Array.isArray(user.clubs) || user.clubs.length === 0) {
    console.log("❌ isUserClubOwnerOrCoOwner: No user or clubs array");
    return false;
  }

  const firstClub = user.clubs[0];

  // Check if clubs are populated with role info (PlayerClubMembership[])
  if (
    typeof firstClub === "object" &&
    "role" in firstClub &&
    "club" in firstClub
  ) {
    const hasOwnerRole = user.clubs.some((m: any) => {
      const isOwner = m.role === "owner" || m.role === "co_owner";
      console.log(`🔍 Checking club membership:`, {
        club: m.club?.name,
        role: m.role,
        isOwner,
      });
      return isOwner;
    });
    console.log(`✅ User has owner/co-owner role: ${hasOwnerRole}`);
    return hasOwnerRole;
  }

  // If clubs are not populated with role info, check each club via API
  console.log(
    "⚠️ Clubs array not populated with role info, checking via API...",
  );

  for (const club of user.clubs) {
    let clubId: string | undefined;

    // Extract club ID from different formats
    if (typeof club === "string") {
      clubId = club;
    } else if (typeof club === "object" && "club" in club) {
      clubId = (club as any).club._id || (club as any).club.id;
    } else if (typeof club === "object") {
      clubId = (club as any)._id || (club as any).id;
    }

    if (!clubId) continue;

    console.log(`🔍 Checking role for club ${clubId}...`);
    const role = await getUserClubRole(user, clubId);
    console.log(`   Role: ${role}`);

    if (role === "owner" || role === "co_owner") {
      console.log(`✅ Found owner/co-owner role in club ${clubId}`);
      return true;
    }
  }

  console.log("❌ User is not owner/co-owner of any club");
  return false;
};

/**
 * Checks if user is a member of a specific club
 */
export const isUserMemberOfClub = (
  user: Player | null,
  clubId: string,
): boolean => {
  if (!user || !Array.isArray(user.clubs)) return false;

  return user.clubs.some((c: any) => {
    // Handle different club formats
    if (typeof c === "string") {
      return c === clubId;
    } else if (typeof c === "object" && "club" in c) {
      return (c.club._id || c.club.id) === clubId;
    } else if (typeof c === "object") {
      return (c._id || c.id) === clubId;
    }
    return false;
  });
};
