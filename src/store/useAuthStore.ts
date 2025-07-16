import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  
  checkSession: () => Promise<void>;
  setupListener: () => () => void; // Returns the unsubscribe function
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  session: null,
  loading: true,

  // Explicitly checks for an existing session on app startup.
  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        set({ userProfile: data || null });
      } else {
        set({ userProfile: null });
      }
    } catch (error) {
      console.error("Error checking initial session:", error);
      set({ user: null, userProfile: null, session: null });
    } finally {
      set({ loading: false });
    }
  },

  // Sets up the listener for auth changes that happen *after* initial load.
  setupListener: () => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        set({ session, user: session?.user ?? null });

        if (session?.user) {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            set({ userProfile: data || null });
          } catch (error) {
            console.error("Error fetching profile on auth change:", error);
            set({ userProfile: null });
          }
        } else {
          set({ userProfile: null });
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  },

  signIn: async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // Clear visit state from localStorage on sign out
    localStorage.removeItem('activeVisit');
    localStorage.removeItem('activeClient');
    localStorage.removeItem('visitNotes');
    localStorage.removeItem('orderItems');
    set({ user: null, userProfile: null, session: null });
  },

  resetPassword: async (email) => {
    return supabase.auth.resetPasswordForEmail(email);
  },
}));