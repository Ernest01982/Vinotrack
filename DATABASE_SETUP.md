# Database Setup Instructions

## Quick Setup (Recommended)

1.  **Connect to Supabase** in your project
2.  **Run the consolidated migration**:
    * Go to your Supabase Dashboard → SQL Editor
    * Copy and paste the contents of `supabase/migrations/consolidated_schema_setup.sql`
    * Click "Run"

## Admin User Setup

Your first admin user should be created securely.

1.  Go to your Supabase Dashboard → Authentication → Users.
2.  Click "Invite" and enter your admin email. This sends a secure link to set your password.
3.  After you sign up, the `handle_new_user` trigger will automatically create your profile with the default 'Rep' role.
4.  **Manually update your role to 'Admin'** in the `profiles` table for full access:
    ```sql
    UPDATE public.profiles SET role = 'Admin' WHERE email = 'your-admin@email.com';
    ```

⚠️ **SECURITY**: Never hardcode credentials. The application now uses an invitation flow for adding new users, which is the recommended secure practice.

## What the Migration Creates

-   ✅ Complete database schema with all tables.
-   ✅ Row Level Security (RLS) policies to protect data.
-   ✅ `handle_new_user` trigger: Automatically creates a `profile` for every new user who signs up, streamlining user management.
-   ✅ Client, product, visit, and order tracking systems.
-   ✅ Performance indexes for faster queries.
-   ✅ Sample product data to get you started.

## Verification

After running the migration and setting up your admin user, verify everything works by:
1.  Logging in with your new admin credentials.
2.  Using the "Invite New User" feature in the admin dashboard to create a sales rep.
3.  Logging in as the new rep to confirm they have the correct, limited access.
4.  Adding clients, products, and testing the visit workflow.

---