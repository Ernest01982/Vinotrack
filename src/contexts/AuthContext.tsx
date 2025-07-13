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
      console.log('📋 fetchUserProfile: No user provided, setting profile to null');
      setUserProfile(null);
      return;
    }

    try {
      console.log('📋 fetchUserProfile: Querying profiles table for user ID:', currentUser.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
        console.error('❌ fetchUserProfile: Database error:', error);
        throw error;
      }
      console.log('✅ fetchUserProfile: Profile data received:', data ? 'Profile found' : 'No profile found');
      setUserProfile(data || null);
    } catch (error) {
      console.error('❌ fetchUserProfile: Error fetching user profile:', error);
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    console.log('🔄 AuthContext: Starting initialization...');
    setLoading(true);
    
    console.log('🔍 AuthContext: Getting initial session...');
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        console.log('✅ AuthContext: Got session response:', session ? 'Session exists' : 'No session');
        setSession(session);
        const currentUser = session?.user ?? null;
        console.log('👤 AuthContext: Current user:', currentUser ? currentUser.email : 'No user');
        setUser(currentUser);
        console.log('📋 AuthContext: Fetching user profile...');
        await fetchUserProfile(currentUser);
      })
      .catch((error) => {
        console.error("❌ AuthContext: Error during initial session fetch:", error);
        console.error("❌ AuthContext: Error details:", error.message);
      })
      .finally(() => {
        console.log('🏁 AuthContext: Initialization complete, setting loading to false');
        setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('🔄 AuthContext: Auth state changed:', _event);
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          console.log('📋 AuthContext: Fetching profile for user:', currentUser.email);
          await fetchUserProfile(currentUser);
        }
        setLoading(false);
      }
    );

    return () => {
      console.log('🧹 AuthContext: Cleaning up auth listener');
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    console.log('📋 fetchUserProfile: Starting for user:', currentUser ? currentUser.email : 'null');
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