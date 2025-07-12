import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import RepDashboard from './components/dashboards/RepDashboard';
import { LoginForm } from './components/auth/LoginForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { AuthGuard } from './components/auth/AuthGuard';

const AppContent: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // This is the main loading screen for the entire app
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">VinoTracker is Loading...</p>
        </div>
      </div>
    );
  }

  // If there is no user, show the appropriate login/password reset form
  if (!user) {
    if (showForgotPassword) {
      return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />;
    }
    return <LoginForm onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  // If there IS a user but NO profile, something is wrong.
  // Instead of getting stuck, we show an error and a way to log out.
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Profile Loading Error</h2>
          <p className="text-gray-400 mb-6">
            There was a problem loading your user profile. This might be due to a database issue.
          </p>
          <p className="text-gray-500 text-sm">
            Please try logging out and back in. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }

  // If user and profile are loaded, show the correct dashboard
  return (
    <AuthGuard>
      {userProfile.role === 'Admin' ? <AdminDashboard /> : <RepDashboard />}
    </AuthGuard>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;