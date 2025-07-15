import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  
  initialize: () => () => void; // Returns the unsubscribe function
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,
  session: null,
  loading: true,

  initialize: () => {
    // Fail-safe timeout: If auth state is not resolved in 10 seconds, stop loading.
    const loadingTimeout = setTimeout(() => {
      if (get().loading) {
        console.error("Authentication timeout. Check Supabase connection.");
        set({ loading: false });
      }
    }, 10000);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Clear the timeout once the listener fires.
        clearTimeout(loadingTimeout);

        try {
          set({ session, user: session?.user ?? null });

          // Fetch user profile if a user exists
          if (session?.user) {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            set({ userProfile: data || null });
          } else {
            // If there's no session, ensure profile is also null
            set({ userProfile: null });
          }
        } catch (error) {
          console.error("Error in onAuthStateChange handler:", error);
          set({ userProfile: null });
        } finally {
          // Ensure loading is always set to false after the first check.
          set({ loading: false });
        }
      }
    );
    
    // Return the unsubscribe function for cleanup
    return () => {
      clearTimeout(loadingTimeout);
      authListener.subscription.unsubscribe();
    };
  },

  signIn: async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // Manually clear state on sign out to ensure UI updates immediately
    set({ user: null, userProfile: null, session: null });
  },

  resetPassword: async (email) => {
    return supabase.auth.resetPasswordForEmail(email);
  },
}));