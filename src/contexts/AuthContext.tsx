import React, { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

// The context now provides the state and actions directly from the Zustand store.
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Select the state and actions from the Zustand store
  const { 
    user, 
    userProfile, 
    session, 
    loading, 
    initialize, 
    signIn, 
    signOut, 
    resetPassword 
  } = useAuthStore();

  // The initialize function is now called once when the store is created,
  // so we no longer need a useEffect here to manage the subscription.

  return (
    <AuthContext.Provider value={{ user, userProfile, session, loading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
