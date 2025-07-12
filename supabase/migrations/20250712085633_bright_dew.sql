/*
  # Create Initial Admin User

  1. New User Setup
    - Creates admin user with email: ernestreyneke@gmail.com
    - Sets password to: Admin123
    - Assigns Admin role
    - Email is automatically confirmed

  2. Profile Creation
    - Creates corresponding profile record
    - Links to auth user via UUID
    - Sets role as 'Admin'
    - Includes full name

  Note: This migration creates the initial admin user for system setup.
  The user will be able to log in immediately after this migration runs.
*/

-- Create the admin user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'ernestreyneke@gmail.com',
  crypt('Admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  '',
  NOW(),
  '',
  NULL,
  '',
  '',
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "Admin", "full_name": "Ernest Reyneke"}',
  FALSE,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  '',
  0,
  NULL,
  '',
  NULL
) ON CONFLICT (email) DO NOTHING;

-- Create the corresponding profile record
INSERT INTO public.profiles (
  id,
  email,
  role,
  full_name,
  created_at
) 
SELECT 
  id,
  'ernestreyneke@gmail.com',
  'Admin',
  'Ernest Reyneke',
  NOW()
FROM auth.users 
WHERE email = 'ernestreyneke@gmail.com'
ON CONFLICT (id) DO NOTHING;