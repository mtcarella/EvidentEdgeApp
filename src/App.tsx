import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { ResetPassword } from './components/ResetPassword';
import { FloatingChat } from './components/FloatingChat';
import { ForcePasswordReset } from './components/ForcePasswordReset';

function App() {
  const { user, loading, forcePasswordReset, chatEnabled } = useAuth();
  const location = useLocation();

  const isResetPasswordPage = location.pathname === '/reset-password';

  if (isResetPasswordPage) {
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && forcePasswordReset) {
    return <ForcePasswordReset />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <LoginForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && chatEnabled && <FloatingChat />}
    </>
  );
}

export default App;
