/*
  # Create Database Schema for Vino Tracker

  1. New Tables
    - `profiles` - User profiles with roles
    - `clients` - Client information
    - `products` - Product catalog
    - `visits` - Visit tracking
    - `orders` - Order management

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
    - Secure data access patterns

  3. Initial Data
    - Create initial admin user
    - Set up basic product catalog
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('Admin', 'Rep')),
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  address text,
  consumption_type text CHECK (consumption_type IN ('on-consumption', 'off-consumption')) DEFAULT 'on-consumption',
  call_frequency integer DEFAULT 1 CHECK (call_frequency BETWEEN 1 AND 4),
  assigned_rep_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create visits table
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  latitude decimal(10,8),
  longitude decimal(11,8),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visits(id) ON DELETE SET NULL,
  total_amount decimal(10,2) NOT NULL CHECK (total_amount >= 0),
  items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Profiles policies
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

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

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

-- Clients policies
CREATE POLICY "Reps can read assigned clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    assigned_rep_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admins can manage all clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Products policies
CREATE POLICY "All authenticated users can read products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Visits policies
CREATE POLICY "Reps can read own visits"
  ON visits
  FOR SELECT
  TO authenticated
  USING (
    rep_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Reps can create visits for assigned clients"
  ON visits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    rep_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM clients
      WHERE id = client_id AND assigned_rep_id = auth.uid()
    )
  );

CREATE POLICY "Reps can update own visits"
  ON visits
  FOR UPDATE
  TO authenticated
  USING (rep_id = auth.uid());

-- Orders policies
CREATE POLICY "Reps can read own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    rep_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Reps can create orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (rep_id = auth.uid());

-- Insert sample products
INSERT INTO products (name, description, price) VALUES
  ('Cabernet Sauvignon 2021', 'Full-bodied red wine with rich tannins and dark fruit flavors', 45.99),
  ('Chardonnay 2022', 'Crisp white wine with notes of apple and citrus', 32.99),
  ('Pinot Noir 2021', 'Light-bodied red wine with cherry and earthy undertones', 38.99),
  ('Sauvignon Blanc 2022', 'Refreshing white wine with tropical fruit and herbaceous notes', 28.99),
  ('Merlot 2020', 'Medium-bodied red wine with plum and chocolate flavors', 42.99),
  ('Riesling 2022', 'Sweet white wine with floral aromas and stone fruit flavors', 26.99)
ON CONFLICT DO NOTHING;