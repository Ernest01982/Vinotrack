import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

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
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      console.error("Error fetching user profile:", error);
      // Even if profile fetch fails, we should not throw an error that stops the app
      setUserProfile(null); 
    } else {
      setUserProfile(data || null);
    }
  }, []);

  useEffect(() => {
    // This is the most robust way to handle auth state.
    // It correctly handles the initial state and any subsequent changes.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setSession(session);
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          await fetchUserProfile(currentUser);
        } catch (e) {
            console.error("Error in onAuthStateChange handler", e)
        } finally {
            // This is the key fix: setLoading(false) is called here,
            // after the initial auth state has been processed.
            setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email);
  }, []);
  
  const value = useMemo(() => ({
    user,
    userProfile,
    session,
    loading,
    signOut,
    signIn,
    resetPassword,
  }), [user, userProfile, session, loading, signOut, signIn, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};