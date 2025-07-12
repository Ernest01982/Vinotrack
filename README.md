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

## Initial Setup

This project requires a Supabase backend. The simplest way to set up the database is to use the Supabase SQL Editor to run a master setup script that creates all tables, policies, and the initial admin user.

### Default Admin Credentials
- **Email**: ernestreyneke@gmail.com
- **Password**: Admin123

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build