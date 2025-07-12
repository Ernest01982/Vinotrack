/*
  # Role-Based Access Control Setup

  1. Profile Management
    - Creates profiles table with proper structure
    - Sets up automatic profile creation trigger
    - Handles role assignment and validation

  2. Security
    - Enable RLS on profiles table
    - Add policies for profile access
    - Ensure users can only read their own profile

  3. Automation
    - Trigger automatically creates profile on user signup
    - Default role is 'Rep' for new users
    - Admin users must be created manually via SQL
*/

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Rep' CHECK (role IN ('Admin', 'Rep')),
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Only admins can insert new profiles (for manual admin creation)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'Rep', -- Default role for new users
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create the initial admin user profile
-- Note: This assumes the admin user already exists in auth.users
DO $$
BEGIN
  -- Insert admin profile if it doesn't exist
  INSERT INTO public.profiles (id, email, role, full_name)
  SELECT 
    id,
    email,
    'Admin',
    'Ernest Reyneke'
  FROM auth.users
  WHERE email = 'ernestreyneke@gmail.com'
  ON CONFLICT (id) DO UPDATE SET
    role = 'Admin',
    full_name = 'Ernest Reyneke';
END $$;