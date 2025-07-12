/*
  # Fix RLS Infinite Recursion Error

  1. Problem
    - Current RLS policies on profiles table cause infinite recursion
    - Policies are querying the profiles table from within themselves
    - This creates a loop that causes database errors

  2. Solution
    - Drop all existing problematic policies
    - Create new non-recursive policies using auth.uid() directly
    - Avoid self-referencing queries in policy expressions

  3. New Policies
    - Users can read their own profile using auth.uid() = id
    - Users can update their own profile using auth.uid() = id
    - Simple, non-recursive policy structure
*/

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Enable read access for users on own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Enable update access for users on own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable insert access for authenticated users"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Note: For admin functionality, we'll handle role-based access in the application layer
-- rather than in RLS policies to avoid recursion issues