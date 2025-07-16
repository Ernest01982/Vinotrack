import React, { createContext, useContext, useEffect, FC, ReactNode } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

// Define the shape of the context's value
interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  resetPassword: (email: string) => Promise<{ error: any | null }>;
}

// Create the context with a default undefined value
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// The AuthProvider component that will wrap your application
export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const {
    user,
    userProfile,
    session,
    loading,
    checkSession,
    setupListener,
    signOut,
    signIn,
    resetPassword,
  } = useAuthStore();

  useEffect(() => {
    // On initial load, check for an existing session
    checkSession();

    // Set up the real-time auth state listener and get the unsubscribe function
    const unsubscribe = setupListener();

    // Cleanup: unsubscribe from the listener when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [checkSession, setupListener]);

  const value: AuthContextValue = {
    user,
    userProfile,
    session,
    loading,
    signOut,
    signIn,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to easily access the auth context
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;