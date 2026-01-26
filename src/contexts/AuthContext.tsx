import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Player } from '../types';
import { ApprovalStatus, UserRole } from '../types';
import * as authApi from '../api/auth';

interface AuthContextType {
  user: Player | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  isApproved: () => boolean;
  canEditEmail: () => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Player | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const isAuthenticated = () => {
    return !!token && !!user;
  };

  const isAdmin = () => {
    return user?.role === UserRole.ADMIN;
  };

  const isApproved = () => {
    return user?.status === ApprovalStatus.APPROVED;
  };

  const canEditEmail = () => {
    return isApproved();
  };

  const refreshUser = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authApi.getCurrentUser();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      const newToken = response.data.token;
      const newUser = response.data.player;
      
      // Set localStorage first
      localStorage.setItem('token', newToken);
      
      // Update state synchronously
      setToken(newToken);
      setUser(newUser);
      setLoading(false);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    // Only run on initial mount
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken && !user) {
        // We have a token but no user (page refresh scenario)
        await refreshUser();
      } else {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []); // Empty dependency array - only run once on mount

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    isAdmin,
    isApproved,
    canEditEmail,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
