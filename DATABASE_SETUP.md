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

## Default Admin Credentials

After running the migration, you can log in with:
- **Email**: `ernestreyneke@gmail.com`
- **Password**: `Admin123`

⚠️ **IMPORTANT**: Change these credentials immediately after first login!

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