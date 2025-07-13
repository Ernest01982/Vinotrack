# Database Setup Instructions

## Quick Setup (Recommended)

1. **Connect to Supabase** in your project
2. **Run the consolidated migration**:
   - Go to your Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `supabase/migrations/consolidated_schema_setup.sql`
   - Click "Run"

## If You Have Existing Conflicting Migrations

If you're experiencing conflicts from previous migration attempts:

1. **First, run the cleanup script**:
   - Copy and paste `supabase/migrations/cleanup_old_migrations.sql`
   - Click "Run"

2. **Then run the consolidated migration**:
   - Copy and paste `supabase/migrations/consolidated_schema_setup.sql`
   - Click "Run"

## Admin User Setup

After running the migration, you need to create your first admin user:

### Option 1: Through Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard → Authentication → Users
2. Click "Add User" 
3. Enter your admin email and secure password
4. After creating the user, the `handle_new_user` trigger will automatically create a profile with 'Rep' role
5. Manually update the role to 'Admin' in the profiles table:
   ```sql
   UPDATE profiles SET role = 'Admin' WHERE email = 'your-admin@email.com';
   ```

### Option 2: Modify the Migration (Advanced)
1. Edit the `consolidated_schema_setup.sql` file
2. Uncomment and modify the admin user creation section with your secure credentials
3. Run the migration

⚠️ **SECURITY**: Never use default credentials in production!

## What the Migration Creates

- ✅ Complete database schema with all tables
- ✅ Row Level Security (RLS) policies
- ✅ User profile management system
- ✅ Client and product management
- ✅ Visit and order tracking
- ✅ Activity logging
- ✅ Performance indexes
- ✅ Default admin user
- ✅ Sample product data

## Verification

After running the migration, verify everything works by:
1. Logging in with the admin credentials
2. Creating a new sales rep user
3. Adding some clients and products
4. Testing the visit workflow

## Troubleshooting

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Ensure you have the correct permissions in your Supabase project
3. Try running the cleanup script first if there are conflicts
4. Contact support if problems persist

The consolidated migration is idempotent - it can be run multiple times safely.