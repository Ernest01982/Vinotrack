import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env'; // Import the validated environment variables

// Create and export the Supabase client.
// The environment variables are now validated at startup in `src/config/env.ts`,
// so the manual check here is no longer necessary.
export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);