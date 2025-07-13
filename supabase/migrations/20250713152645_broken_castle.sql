/*
  # Cleanup Script for Old Migrations
  
  This script removes any conflicting data or policies that might have been created
  by previous migration attempts. Run this BEFORE running the consolidated migration
  if you're experiencing conflicts.
  
  WARNING: This will remove existing data. Only use in development!
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Reps can view assigned clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Reps can manage own visits" ON visits;
DROP POLICY IF EXISTS "Admins can view all visits" ON visits;
DROP POLICY IF EXISTS "Reps can manage own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view activity log" ON activity_log;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop existing functions
DROP FUNCTION IF EXISTS handle_new_user();

-- Clean up any duplicate admin users (keep only one)
DO $$
DECLARE
  admin_count integer;
  admin_to_keep uuid;
BEGIN
  SELECT COUNT(*) INTO admin_count 
  FROM profiles 
  WHERE email = 'ernestreyneke@gmail.com';
  
  IF admin_count > 1 THEN
    -- Keep the first admin user, delete the rest
    SELECT id INTO admin_to_keep 
    FROM profiles 
    WHERE email = 'ernestreyneke@gmail.com' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    DELETE FROM profiles 
    WHERE email = 'ernestreyneke@gmail.com' 
    AND id != admin_to_keep;
    
    RAISE NOTICE 'Cleaned up duplicate admin users, kept: %', admin_to_keep;
  END IF;
END $$;

-- Reset sequences if needed
-- (Add any sequence resets here if you have custom sequences)

RAISE NOTICE 'Cleanup completed. You can now run the consolidated migration.';