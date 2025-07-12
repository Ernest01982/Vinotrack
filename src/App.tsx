import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import RepDashboard from './components/dashboards/RepDashboard';
import { LoginForm } from './components/auth/LoginForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';

const AppContent: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Initial loading state for the whole application
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">VinoTracker is Initializing...</p>
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

  // If user is logged in, but we are still waiting for the profile
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
        <div>
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-300 mb-4">Loading User Profile...</h2>
          <p className="text-gray-500">This should only take a moment.</p>
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