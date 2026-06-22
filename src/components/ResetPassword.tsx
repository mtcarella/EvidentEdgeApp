import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const attemptedExchange = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const establishSession = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const errorParam = url.searchParams.get('error');
      const errorDesc = url.searchParams.get('error_description');

      if (errorParam || errorDesc) {
        if (!cancelled) {
          setError(errorDesc ? decodeURIComponent(errorDesc) : 'An error occurred with the reset link.');
          setInitializing(false);
        }
        return;
      }

      // Handle PKCE code exchange
      if (code && !attemptedExchange.current) {
        attemptedExchange.current = true;
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          // The code may have already been consumed by the global Supabase client
          // via detectSessionInUrl. Check if we already have a session.
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSessionReady(true);
            setInitializing(false);
            url.searchParams.delete('code');
            window.history.replaceState({}, '', url.pathname);
            return;
          }
          setError('This reset link is invalid or has already been used. Please request a new password reset from the login page.');
          setInitializing(false);
          return;
        }
        // Exchange succeeded
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.pathname);
        setSessionReady(true);
        setInitializing(false);
        return;
      }

      // No code in URL - check if session was already established (e.g., by detectSessionInUrl or token hash)
      // Give a brief moment for the Supabase client to process URL tokens
      await new Promise(r => setTimeout(r, 500));
      if (cancelled) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        setError('Invalid or expired reset link. Please request a new password reset from the login page.');
      }
      setInitializing(false);
    };

    establishSession();

    // Also listen for PASSWORD_RECOVERY event from onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (!cancelled) {
          setSessionReady(true);
          setInitializing(false);
          setError('');
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      // Sign out after successful reset so user logs in with new password
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3c4f54] via-[#2f4649] to-[#3c4f54] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-20 h-20 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful!</h2>
          <p className="text-gray-600 mb-4">
            Your password has been successfully reset. You will be redirected to the login page in a moment.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[#adce60] hover:bg-[#9bbf50] text-[#3c4f54] font-semibold rounded-lg transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3c4f54] via-[#2f4649] to-[#3c4f54] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-10 h-10 text-[#3c4f54] animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3c4f54] via-[#2f4649] to-[#3c4f54] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-6">
            <img
              src="/circle-logo.png"
              alt="Evident Title Agency"
              className="h-32 w-32 object-contain"
            />
          </div>

          <h2 className="text-3xl font-bold text-center text-[#3c4f54] mb-2">
            Reset Your Password
          </h2>
          <p className="text-center text-slate-600 mb-8">
            Enter your new password below
          </p>

          {!sessionReady ? (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div className="text-center">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2 bg-[#adce60] hover:bg-[#9bbf50] text-[#3c4f54] font-semibold rounded-lg transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#adce60] hover:bg-[#9bbf50] text-[#3c4f54] font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

          {sessionReady && (
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-sm text-[#3c4f54] hover:text-[#adce60] font-medium transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
