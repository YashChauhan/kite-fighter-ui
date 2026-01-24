import { useAuth } from "../contexts/AuthContext";

export const useCanModify = (): boolean => {
  const { isApproved } = useAuth();
  return isApproved();
};
