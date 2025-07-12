import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import RepDashboard from './components/dashboards/RepDashboard';
import { LoginForm } from './components/auth/LoginForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';

const AppContent: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Show a loading screen while the app is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  // If there is no authenticated user, show the login form
  if (!user) {
    if (showForgotPassword) {
      return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />;
    }
    return <LoginForm onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  // If we have a user, but no profile yet, show a profile loading screen.
  // This is what you see AFTER a successful login.
  if (!userProfile) {
    return (
       <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center">
        <div>
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-300 mb-4">Loading Profile...</h2>
          <p className="text-gray-500">If this screen persists, there is an issue with the database.</p>
        </div>
      </div>
    );
  }

  // If the user and profile are loaded, show the correct dashboard
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