/*
  # Consolidated Database Schema Setup

  This migration sets up the complete Vino Tracker database schema including:

  1. Database Extensions
  2. User Profiles System
  3. Client Management
  4. Product Inventory
  5. Visit Tracking
  6. Order Management
  7. Activity Logging
  8. Row Level Security (RLS)
  9. Default Admin User Setup

  This script is idempotent and can be run multiple times safely.
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Admin', 'Rep');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE consumption_type AS ENUM ('on-consumption', 'off-consumption');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Rep' CHECK (role IN ('Admin', 'Rep')),
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create RLS policies for profiles
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- 2. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  address text,
  consumption_type text DEFAULT 'on-consumption' CHECK (consumption_type IN ('on-consumption', 'off-consumption')),
  call_frequency integer DEFAULT 1 CHECK (call_frequency >= 1 AND call_frequency <= 4),
  assigned_rep_id uuid REFERENCES profiles(id),
  latitude numeric(10,8),
  longitude numeric(11,8),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Reps can view assigned clients" ON clients;

-- Create RLS policies for clients
CREATE POLICY "Admins can manage all clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin'
  );

CREATE POLICY "Reps can view assigned clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    assigned_rep_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin'
  );

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- Create RLS policies for products
CREATE POLICY "Authenticated users can view products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin'
  );

-- 4. VISITS TABLE
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  latitude numeric(10,8),
  longitude numeric(11,8),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on visits
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Reps can manage own visits" ON visits;
DROP POLICY IF EXISTS "Admins can view all visits" ON visits;

-- Create RLS policies for visits
CREATE POLICY "Reps can manage own visits"
  ON visits
  FOR ALL
  TO authenticated
  USING (
    rep_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin'
  );

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visits(id) ON DELETE SET NULL,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount >= 0),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Reps can manage own orders" ON visits;
DROP POLICY IF EXISTS "Admins can view all orders" ON visits;

-- Create RLS policies for orders
CREATE POLICY "Reps can manage own orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    rep_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin'
  );

-- 6. ACTIVITY LOG TABLE (Optional - for admin dashboard)
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  message text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view activity log" ON activity_log;

-- Create RLS policies for activity_log
CREATE POLICY "Admins can view activity log"
  ON activity_log
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin'
  );

-- 7. TRIGGER FUNCTION FOR NEW USER PROFILE CREATION
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'Rep'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 8. CREATE DEFAULT ADMIN USER (IDEMPOTENT)
DO $$
DECLARE
  admin_user_id uuid;
  admin_email text := 'ernestreyneke@gmail.com';
  admin_password text := 'Admin123';
BEGIN
  -- Check if admin user already exists in auth.users
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = admin_email;
  
  -- If admin doesn't exist, create the user
  IF admin_user_id IS NULL THEN
    -- Insert into auth.users (this will trigger the profile creation)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"Admin","full_name":"System Administrator"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ) RETURNING id INTO admin_user_id;
    
    RAISE NOTICE 'Created admin user with email: %', admin_email;
  ELSE
    -- Update existing user's profile to ensure admin role
    UPDATE profiles 
    SET role = 'Admin', full_name = 'System Administrator'
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Updated existing admin user: %', admin_email;
  END IF;
  
  -- Ensure the profile exists and has admin role
  INSERT INTO profiles (id, email, role, full_name, created_at)
  VALUES (admin_user_id, admin_email, 'Admin', 'System Administrator', now())
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = 'Admin',
    full_name = 'System Administrator';
    
END $$;

-- 9. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_clients_assigned_rep ON clients(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_rep_id ON visits(rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_start_time ON visits(start_time);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_rep_id ON orders(rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- 10. SAMPLE DATA (OPTIONAL - REMOVE IN PRODUCTION)
-- Insert sample products if none exist
INSERT INTO products (name, description, price) 
SELECT * FROM (VALUES 
  ('Cabernet Sauvignon 2021', 'Full-bodied red wine with rich tannins and dark fruit flavors', 299.99),
  ('Chardonnay 2022', 'Crisp white wine with citrus notes and oak aging', 199.99),
  ('Pinotage 2021', 'South African signature red with smoky and earthy characteristics', 249.99),
  ('Sauvignon Blanc 2022', 'Fresh and zesty white wine with tropical fruit aromas', 179.99),
  ('Merlot 2021', 'Smooth red wine with plum and chocolate undertones', 269.99)
) AS v(name, description, price)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

-- Log the completion
INSERT INTO activity_log (type, message, created_at)
VALUES ('SYSTEM', 'Database schema setup completed successfully', now())
ON CONFLICT DO NOTHING;

-- Final verification
DO $$
BEGIN
  RAISE NOTICE 'Database setup completed successfully!';
  RAISE NOTICE 'Default admin credentials:';
  RAISE NOTICE 'Email: ernestreyneke@gmail.com';
  RAISE NOTICE 'Password: Admin123';
  RAISE NOTICE 'Please change these credentials after first login!';
END $$;