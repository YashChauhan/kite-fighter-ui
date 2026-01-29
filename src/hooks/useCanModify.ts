import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isUserClubOwnerOrCoOwner } from "../utils/clubPermissions";

export const useCanModify = (): boolean => {
  const { isApproved } = useAuth();
  return isApproved();
};

export const useCanCreateMatch = (): boolean => {
  const { user, isAdmin } = useAuth();
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      console.log("🚀 === useCanCreateMatch: Starting check ===");
      console.log("🚀 User:", user);
      console.log("🚀 User ID:", user?._id || user?.id);
      console.log("🚀 isAdmin():", isAdmin());

      if (!user) {
        console.log("❌ No user");
        setCanCreate(false);
        setLoading(false);
        return;
      }

      // Admin can always create matches
      if (isAdmin()) {
        console.log("✅ User is admin - can create matches");
        setCanCreate(true);
        setLoading(false);
        return;
      }

      // Check if user is owner or co-owner of any club using populated clubs array
      console.log("🔍 Checking if user is club owner/co-owner...");
      const isOwnerOrCoOwner = await isUserClubOwnerOrCoOwner(user);
      console.log(`✅ isUserClubOwnerOrCoOwner result: ${isOwnerOrCoOwner}`);

      setCanCreate(isOwnerOrCoOwner);
      setLoading(false);
    };

    checkPermission();
  }, [user, isAdmin]);

  const result = loading ? false : canCreate;
  console.log("🎯 useCanCreateMatch returning:", result, {
    loading,
    canCreate,
  });

  return result;
};
