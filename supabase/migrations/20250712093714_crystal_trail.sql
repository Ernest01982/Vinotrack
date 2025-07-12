/*
  # Ensure Admin Profile Exists

  This migration ensures that the admin user profile exists and has the correct role.
  It will create or update the profile for ernestreyneke@gmail.com to have Admin role.
*/

-- First, let's check if we need to create the auth user
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Try to find existing auth user
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'ernestreyneke@gmail.com' 
    LIMIT 1;
    
    -- If no auth user exists, we can't create one here (needs to be done through Supabase Auth)
    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'Auth user for ernestreyneke@gmail.com not found. Please create through Supabase Auth first.';
    ELSE
        -- Ensure profile exists with Admin role
        INSERT INTO public.profiles (id, email, role, full_name, created_at)
        VALUES (
            admin_user_id,
            'ernestreyneke@gmail.com',
            'Admin',
            'Ernest Reyneke',
            NOW()
        )
        ON CONFLICT (id) 
        DO UPDATE SET 
            role = 'Admin',
            full_name = COALESCE(profiles.full_name, 'Ernest Reyneke'),
            email = 'ernestreyneke@gmail.com';
            
        RAISE NOTICE 'Admin profile created/updated for ernestreyneke@gmail.com';
    END IF;
END $$;