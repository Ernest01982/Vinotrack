# Vino Tracker - Professional Wine Sales Management System

A comprehensive wine sales and client management system built with React, TypeScript, and Supabase. Designed for commercial use by wine sales teams and distributors.

## 🚀 Features

### Admin Dashboard
- **User Management**: Create and manage sales representatives and administrators
- **Product Inventory**: Add, edit, and manage wine products with pricing
- **Bulk Operations**: Upload products and clients via Excel/CSV files
- **Analytics & Reporting**: Comprehensive sales and visit analytics
- **System Administration**: Full control over users, products, and data

### Sales Representative Dashboard
- **Client Management**: View and manage assigned clients with priority indicators
- **Visit Tracking**: Start/end visits with GPS location tracking
- **Visit Notes**: Real-time note-taking with auto-save functionality
- **Order Management**: Place orders with automatic PDF generation
- **Visit History**: Complete history of client interactions
- **Priority System**: Automatic client prioritization based on visit frequency

### Key Capabilities
- **Geolocation Tracking**: Automatic location capture for visit verification
- **PDF Generation**: Professional order receipts and documentation
- **Real-time Updates**: Live data synchronization across all users
- **Mobile Responsive**: Works perfectly on tablets and mobile devices
- **Secure Authentication**: Role-based access control with Supabase Auth
- **Data Export**: Excel/CSV export capabilities for reporting

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **PDF Generation**: jsPDF with autoTable
- **Excel Processing**: SheetJS (xlsx)
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Deployment**: Netlify

## 📋 Prerequisites

- Node.js 16+ and npm
- Supabase account and project
- Modern web browser with geolocation support

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Database Setup

Run the provided SQL migrations in your Supabase SQL Editor to set up:
- User profiles and authentication
- Client management tables
- Product inventory
- Visit tracking
- Order management
- Row Level Security (RLS) policies

### 3. Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### 4. Default Admin Access

After running the database migration, you can create your first admin user through the Supabase Auth interface or by running the provided SQL migration which creates a default admin account.

⚠️ **IMPORTANT**: Change default credentials immediately after first login for security.

## 📊 Database Schema

### Core Tables
- **profiles**: User management with role-based access
- **clients**: Customer information and assignment to reps
- **products**: Wine inventory with pricing
- **visits**: Visit tracking with geolocation and notes
- **orders**: Order management with itemized details

### Security Features
- Row Level Security (RLS) enabled on all tables
- Role-based access control (Admin/Rep)
- Secure authentication with Supabase Auth
- Data isolation between different user roles

## 🔧 Configuration

### User Roles
- **Admin**: Full system access, user management, reporting
- **Rep**: Client management, visit tracking, order placement

### Client Types
- **On-Consumption**: Restaurants, bars, hotels
- **Off-Consumption**: Retail stores, wine shops

### Visit Frequency
- Configurable from 1-4 visits per month per client
- Automatic priority calculation based on last visit date

## 📱 Mobile Support

The application is fully responsive and optimized for:
- Tablets (primary mobile device for sales reps)
- Smartphones (emergency access and quick updates)
- Desktop computers (admin and office use)

## 🔒 Security Features

- **Authentication**: Secure email/password authentication
- **Authorization**: Role-based access control
- **Data Protection**: Row-level security policies
- **Session Management**: Automatic session handling
- **Password Reset**: Secure password recovery system

## 📈 Analytics & Reporting

### Admin Analytics
- Total clients and products
- Visit statistics (daily, weekly, monthly)
- Rep performance metrics
- Revenue tracking
- Client type distribution

### Rep Insights
- Personal visit statistics
- Client priority indicators
- Order history and totals
- Performance tracking

## 🚀 Deployment

The application is ready for production deployment on:
- **Netlify** (recommended, included in build)
- **Vercel**
- **AWS Amplify**
- Any static hosting service

### Production Checklist
- [ ] Create secure admin credentials
- [ ] Configure custom domain
- [ ] Set up SSL certificate
- [ ] Configure environment variables
- [ ] Test all user flows
- [ ] Set up monitoring and analytics

## 🔄 Data Management

### Bulk Import
- Excel/CSV upload for products and clients
- Validation and error reporting
- Batch processing with progress tracking

### Data Export
- Export client lists
- Visit reports
- Order history
- Analytics data

## 🛡 Best Practices

### For Administrators
1. Regularly review user access and permissions
2. Monitor system usage and performance
3. Keep product inventory updated
4. Review and analyze visit patterns
5. Backup important data regularly

### For Sales Representatives
1. Start visits when arriving at client location
2. Always end visits when leaving
3. Add detailed notes for each visit
4. Update client information as needed
5. Place orders during visits for better tracking

## 🆘 Support & Troubleshooting

### Common Issues
- **Login Problems**: Check email/password, verify account status
- **Visit Tracking**: Ensure location permissions are enabled
- **PDF Generation**: Check browser popup blockers
- **Data Sync**: Refresh page if data seems outdated

### Performance Tips
- Use modern browsers (Chrome, Firefox, Safari, Edge)
- Enable location services for accurate visit tracking
- Maintain stable internet connection for real-time features
- Clear browser cache if experiencing issues

## 📄 License

This is a commercial application. All rights reserved.

## 🤝 Contributing

This is a commercial product. For feature requests or bug reports, please contact the development team.

## Environment Tips

When working in Codex the shell limits each line of output. If a command prints
over 1600 bytes in a single line, the session closes. Use tools such as

```bash
grep -nE 'PATTERN' FILE | cut -c1-200
```

to keep line lengths short when inspecting large files.

---

**Vino Tracker** - Professional wine sales management made simple.