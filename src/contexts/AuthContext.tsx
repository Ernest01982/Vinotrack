import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session and set up auth state listener
    const initAuth = async () => {
      console.log('Starting auth initialization...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error);
          setLoading(false);
          return;
        }
        
        console.log('Initial session:', session?.user?.email || 'No session');
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('User found, fetching profile...');
          await fetchUserProfile(session.user.id);
        } else {
          console.log('No user session, setting loading to false');
          setUserProfile(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      } finally {
        console.log('Auth initialization complete');
      }
    };

    // Set a safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      console.warn('Auth initialization taking too long, forcing completion');
      setLoading(false);
    }, 5000);

    initAuth()
      .then(() => {
        console.log('Auth init completed successfully');
        clearTimeout(safetyTimeout);
      })
      .catch((error) => {
        console.error('Auth init failed:', error);
        setLoading(false);
        clearTimeout(safetyTimeout);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email || 'No user');
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('Auth state changed - fetching profile for:', session.user.email);
        await fetchUserProfile(session.user.id);
      } else {
        console.log('Auth state changed - no user');
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log('fetchUserProfile called for:', userId);
    try {
      // Skip database call if no Supabase connection
      if (!supabase) {
        console.log('No Supabase connection, creating fallback profile');
        const fallbackProfile = {
          id: userId,
          email: user?.email || 'test@example.com',
          role: 'Rep' as const,
          full_name: user?.email || 'Test User',
          created_at: new Date().toISOString()
        };
        setUserProfile(fallbackProfile);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch error:', error.message, 'Creating fallback...');
        // Create a fallback profile if profile doesn't exist
        const fallbackProfile = {
          id: userId,
          email: user?.email || '',
          role: 'Rep' as const,
          full_name: user?.email || '',
          created_at: new Date().toISOString()
        };
        setUserProfile(fallbackProfile);
        setLoading(false);
        return;
      }

      if (data) {
        console.log('Profile found:', data.email, 'Role:', data.role);
        setUserProfile(data);
      } else {
        console.log('No profile data, creating basic profile');
        // Create a fallback profile if none exists
        const basicProfile = {
          id: userId,
          email: user?.email || '',
          role: 'Rep' as const,
          full_name: user?.email || '',
          created_at: new Date().toISOString()
        };
        setUserProfile(basicProfile);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Unexpected error fetching user profile:', error);
      // Create a fallback profile to prevent infinite loading
      if (user?.email) {
        const fallbackProfile = {
          id: userId,
          email: user.email,
          role: 'Rep' as const,
          full_name: user.email,
          created_at: new Date().toISOString()
        };
        setUserProfile(fallbackProfile);
      } else {
        console.log('No user email available, setting profile to null');
        setUserProfile(null);
      }
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error.message);
      throw error;
    }
    console.log('Sign in successful');
  };

  const signUp = async (email: string, password: string, role: string) => {
    console.log('Attempting sign up for:', email, 'with role:', role);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: email, // Default full name to email
        },
      },
    });

    if (error) {
      console.error('Sign up error:', error.message);
      throw error;
    }
    console.log('Sign up successful');
  };

  const signOut = async () => {
    console.log('Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error.message);
      throw error;
    }
    console.log('Sign out successful');
  };

  const resetPassword = async (email: string) => {
    console.log('Requesting password reset for:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error.message);
      throw error;
    }
    console.log('Password reset email sent');
  };

  const value = {
    user,
    userProfile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};