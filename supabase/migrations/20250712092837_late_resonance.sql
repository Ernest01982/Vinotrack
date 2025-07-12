/*
  # Set Admin User

  1. Admin User Setup
    - Ensures ernestreyneke@gmail.com exists in profiles table
    - Sets role to 'Admin' for this user
    - Creates user if they don't exist (with placeholder ID)
    
  2. Notes
    - This migration ensures the admin user is properly configured
    - If the user doesn't exist in auth.users, they'll need to sign up first
    - The role will be correctly set to 'Admin' regardless
*/

-- First, try to insert the admin user profile if it doesn't exist
-- We'll use a placeholder UUID that will be updated when they actually sign up
INSERT INTO public.profiles (id, email, role, full_name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'ernestreyneke@gmail.com',
  'Admin',
  'Ernest Reyneke',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'Admin',
  full_name = COALESCE(profiles.full_name, 'Ernest Reyneke');

-- Also update any existing profile with this email to Admin role
UPDATE public.profiles 
SET role = 'Admin', full_name = COALESCE(full_name, 'Ernest Reyneke')
WHERE email = 'ernestreyneke@gmail.com';

-- Create the auth user if it doesn't exist (this requires admin privileges)
-- Note: This part may need to be done manually in Supabase dashboard
-- as it requires admin API access

-- For manual creation in Supabase dashboard:
-- 1. Go to Authentication > Users
-- 2. Create user with email: ernestreyneke@gmail.com
-- 3. Set password: Admin123
-- 4. The trigger will automatically create the profile
-- 5. This migration will ensure the role is set to 'Admin'