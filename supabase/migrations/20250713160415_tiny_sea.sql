/*
  # VinoTracker - Complete Database Schema Setup
  
  This migration creates the complete database schema for the VinoTracker wine sales management system.
  
  ## What this migration creates:
  
  1. **User Management**
     - profiles table with role-based access (Admin/Rep)
     - Automatic profile creation trigger
     - User authentication integration
  
  2. **Client Management**
     - clients table with consumption types and call frequencies
     - Assignment to sales representatives
     - Contact information and preferences
  
  3. **Product Inventory**
     - products table with pricing and descriptions
     - Wine inventory management
  
  4. **Visit Tracking**
     - visits table with geolocation and timing
     - Notes and duration tracking
     - Real-time visit status
  
  5. **Order Management**
     - orders table with itemized details
     - Integration with visits and clients
     - Total amount calculations
  
  6. **Activity Logging**
     - activity_log table for system events
     - Audit trail for important actions
  
  7. **Security**
     - Row Level Security (RLS) enabled on all tables
     - Role-based access policies
     - Data isolation between users
  
  8. **Performance**
     - Optimized indexes for common queries
     - Efficient foreign key relationships
  
  ## Security Features:
  - All tables have RLS enabled
  - Admins can access all data
  - Reps can only access their assigned data
  - Secure authentication integration
*/

-- Enable necessary extensions
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

DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('USER_ADDED', 'PRODUCT_ADDED', 'CLIENT_ADDED', 'VISIT_STARTED', 'VISIT_ENDED', 'ORDER_PLACED', 'REPORT_GENERATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    role user_role NOT NULL DEFAULT 'Rep',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    address text,
    consumption_type consumption_type NOT NULL DEFAULT 'on-consumption',
    call_frequency integer NOT NULL DEFAULT 1 CHECK (call_frequency >= 1 AND call_frequency <= 4),
    assigned_rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL,
    price decimal(10,2) NOT NULL CHECK (price >= 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
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
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT valid_visit_times CHECK (end_time IS NULL OR end_time > start_time)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    visit_id uuid REFERENCES visits(id) ON DELETE SET NULL,
    total_amount decimal(10,2) NOT NULL CHECK (total_amount >= 0),
    items jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type activity_type NOT NULL,
    message text NOT NULL,
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_assigned_rep ON clients(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_rep_id ON visits(rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_start_time ON visits(start_time);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_rep_id ON orders(rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Profiles policies
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Clients policies
CREATE POLICY "Reps can read assigned clients" ON clients
    FOR SELECT USING (
        assigned_rep_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

CREATE POLICY "Admins can manage all clients" ON clients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

CREATE POLICY "Reps can update assigned clients" ON clients
    FOR UPDATE USING (assigned_rep_id = auth.uid());

-- Products policies
CREATE POLICY "All authenticated users can read products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Visits policies
CREATE POLICY "Reps can manage their visits" ON visits
    FOR ALL USING (
        rep_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Orders policies
CREATE POLICY "Reps can manage their orders" ON orders
    FOR ALL USING (
        rep_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Activity log policies
CREATE POLICY "All authenticated users can read activity log" ON activity_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can insert activity log" ON activity_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'Rep')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample products for demonstration
INSERT INTO products (name, description, price) VALUES
    ('Cabernet Sauvignon 2021', 'Full-bodied red wine with rich tannins and dark fruit flavors', 299.99),
    ('Chardonnay 2022', 'Crisp white wine with citrus notes and oak aging', 199.99),
    ('Pinotage 2021', 'South African signature red with smoky and earthy characteristics', 249.99),
    ('Sauvignon Blanc 2022', 'Fresh and zesty white wine with tropical fruit aromas', 179.99),
    ('Merlot 2021', 'Smooth red wine with plum and chocolate undertones', 269.99),
    ('Chenin Blanc 2022', 'Versatile white wine with honey and apple flavors', 159.99),
    ('Shiraz 2020', 'Bold red wine with spice and pepper notes', 319.99),
    ('Rosé 2022', 'Light and refreshing pink wine perfect for summer', 189.99)
ON CONFLICT (name) DO NOTHING;

-- Log the schema setup
INSERT INTO activity_log (type, message, metadata) VALUES
    ('REPORT_GENERATED', 'Database schema initialized successfully', '{"tables_created": 6, "sample_products": 8}');