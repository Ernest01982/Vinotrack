@@ .. @@
 -- Create default admin user (change credentials immediately after first login)
-INSERT INTO auth.users (
-  id,
-  instance_id,
-  email,
-  encrypted_password,
-  email_confirmed_at,
-  created_at,
-  updated_at,
-  raw_app_meta_data,
-  raw_user_meta_data,
-  is_super_admin,
-  role
-) VALUES (
-  '00000000-0000-0000-0000-000000000001'::uuid,
-  '00000000-0000-0000-0000-000000000000'::uuid,
-  'ernestreyneke@gmail.com',
-  crypt('Admin123', gen_salt('bf')),
-  now(),
-  now(),
-  now(),
-  '{"provider": "email", "providers": ["email"]}',
-  '{"full_name": "System Administrator"}',
-  false,
-  'authenticated'
-) ON CONFLICT (email) DO UPDATE SET
-  encrypted_password = EXCLUDED.encrypted_password,
-  updated_at = now();
+-- Note: Create your admin user through Supabase Auth UI or modify this section
+-- with your secure credentials before running the migration
+-- 
+-- Example (uncomment and modify):
+-- INSERT INTO auth.users (
+--   id,
+--   instance_id,
+--   email,
+--   encrypted_password,
+--   email_confirmed_at,
+--   created_at,
+--   updated_at,
+--   raw_app_meta_data,
+--   raw_user_meta_data,
+--   is_super_admin,
+--   role
+-- ) VALUES (
+--   gen_random_uuid(),
+--   '00000000-0000-0000-0000-000000000000'::uuid,
+--   'your-admin@email.com',
+--   crypt('YourSecurePassword123!', gen_salt('bf')),
+--   now(),
+--   now(),
+--   now(),
+--   '{"provider": "email", "providers": ["email"]}',
+--   '{"full_name": "System Administrator"}',
+--   false,
+--   'authenticated'
+-- ) ON CONFLICT (email) DO NOTHING;
 
 -- Create corresponding profile for admin user
-INSERT INTO public.profiles (
-  id,
-  email,
-  role,
-  full_name,
-  created_at
-) VALUES (
-  '00000000-0000-0000-0000-000000000001'::uuid,
-  'ernestreyneke@gmail.com',
-  'Admin',
-  'System Administrator',
-  now()
-) ON CONFLICT (id) DO UPDATE SET
-  role = EXCLUDED.role,
-  full_name = EXCLUDED.full_name;
+-- (Uncomment when you create the admin user above)
+-- INSERT INTO public.profiles (
+--   id,
+--   email,
+--   role,
+--   full_name,
+--   created_at
+-- ) VALUES (
+--   (SELECT id FROM auth.users WHERE email = 'your-admin@email.com'),
+--   'your-admin@email.com',
+--   'Admin',
+--   'System Administrator',
+--   now()
+-- ) ON CONFLICT (id) DO UPDATE SET
+--   role = EXCLUDED.role,
+--   full_name = EXCLUDED.full_name;