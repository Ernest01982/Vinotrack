import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Config Check:');
console.log('📍 VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('🔑 VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('❌ URL:', supabaseUrl || 'MISSING');
  console.error('❌ Key:', supabaseAnonKey || 'MISSING');
}

console.log('🚀 Creating Supabase client...');
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('✅ Supabase client created successfully');

export type UserRole = 'Admin' | 'Rep';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  created_at: string;
}