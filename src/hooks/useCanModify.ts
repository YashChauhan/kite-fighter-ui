import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getClubs } from "../api/clubs";
import { getClubMembers } from "../api/clubs";

export const useCanModify = (): boolean => {
  const { isApproved } = useAuth();
  return isApproved();
};

export const useCanCreateMatch = (): boolean => {
  const { user, isAdmin, isApproved } = useAuth();
  const [isClubOwner, setIsClubOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkClubOwnership = async () => {
      if (!user || !isApproved()) {
        setIsClubOwner(false);
        setLoading(false);
        return;
      }

      // Admin can always create matches
      if (isAdmin()) {
        setIsClubOwner(true);
        setLoading(false);
        return;
      }

      try {
        // Get all approved clubs
        const clubsResponse = await getClubs({
          status: "approved",
          limit: 100,
        });

        // Check if user is owner or co-owner of any club
        for (const club of clubsResponse.data) {
          const clubId = club._id || club.id;
          if (!clubId) continue;

          try {
            const members = await getClubMembers(clubId);
            const userMembership = members.find(
              (m) => (m.playerId._id || m.playerId) === (user._id || user.id),
            );

            if (
              userMembership &&
              (userMembership.role === "owner" ||
                userMembership.role === "co_owner")
            ) {
              setIsClubOwner(true);
              setLoading(false);
              return;
            }
          } catch (err) {
            // If we can't get members for a club, skip it
            console.error(`Failed to get members for club ${clubId}:`, err);
            continue;
          }
        }

        setIsClubOwner(false);
      } catch (err) {
        console.error("Failed to check club ownership:", err);
        setIsClubOwner(false);
      } finally {
        setLoading(false);
      }
    };

    checkClubOwnership();
  }, [user, isAdmin, isApproved]);

  // Return true if admin or club owner, but wait for loading to complete
  return loading ? false : isAdmin() || isClubOwner;
};
