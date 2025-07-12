# Vino Tracker - Wine Management System

A comprehensive wine sales and client management system built with React, TypeScript, and Supabase.

## Features

### Admin Dashboard
- User management (create Reps and Admins)
- Bulk product upload via Excel/CSV
- Analytics and reporting
- System administration

### Rep Dashboard
- Client visit management with geolocation
- Visit notes and history tracking
- Order placement with PDF generation
- Client relationship management

## Role-Based Access Control

### Authentication System
The app uses Supabase Auth with automatic profile creation:

1. **Automatic Profile Creation**: When a user signs up, a trigger automatically creates a profile with default role 'Rep'
2. **Role Assignment**: Users can be assigned 'Admin' or 'Rep' roles
3. **Conditional Dashboards**: The app renders different dashboards based on user role

### Creating the First Admin User

**Important**: The first Admin user must be created manually after signup:

1. Sign up a new user through the normal process (they will get 'Rep' role by default)
2. In Supabase SQL Editor, run this command to promote them to Admin:

```sql
UPDATE public.profiles 
SET role = 'Admin' 
WHERE email = 'your-admin-email@example.com';
```

3. The user will need to log out and log back in to see the Admin dashboard

### Default Credentials
- **Email**: ernestreyneke@gmail.com
- **Password**: Admin123
- **Role**: Admin

## Database Schema

### Tables
- `profiles` - User profiles with roles
- `clients` - Customer information
- `products` - Wine inventory
- `visits` - Client visit tracking
- `orders` - Order management

### Security
- Row Level Security (RLS) enabled on all tables
- Role-based access policies
- Secure user authentication

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file with your Supabase credentials:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Icons**: Lucide React
- **PDF Generation**: jsPDF
- **File Processing**: XLSX
- **Build Tool**: Vite