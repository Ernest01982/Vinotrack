import React, { useState } from 'react';
import AuthProvider, { useAuth } from './contexts/AuthContext'; // <-- IMPORT UPDATED HERE
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import RepDashboard from './components/dashboards/RepDashboard';
import { LoginForm } from './components/auth/LoginForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { Button } from './components/ui/Button';

const AppContent: React.FC = () => {
  const { user, userProfile, loading, signOut } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Initial loading state for the whole application
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="space-y-2">
            <p className="text-white text-lg font-medium">VinoTracker</p>
            <p className="text-gray-400">Initializing application...</p>
          </div>
        </div>
      </div>
    );
  }

  // If there's no user, direct to authentication
  if (!user) {
    return showForgotPassword
      ? <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
      : <LoginForm onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  // If user is logged in, but the profile is missing (error state)
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Profile Error</h2>
          <p className="text-gray-400 mb-6 max-w-sm">
            We couldn't load your user profile. This can happen if the profile is missing or due to a network issue. Please try signing out and back in, or contact support if the problem persists.
          </p>
          <Button onClick={signOut} variant="secondary" size="lg">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // User and profile are loaded, show the correct dashboard
  return userProfile.role === 'Admin' ? <AdminDashboard /> : <RepDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
