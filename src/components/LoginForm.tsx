import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

export function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    if (isLockedOut && lockoutTimeRemaining > 0) {
      const timer = setInterval(() => {
        setLockoutTimeRemaining(prev => {
          if (prev <= 1000) {
            setIsLockedOut(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isLockedOut, lockoutTimeRemaining]);

  const checkRateLimit = async (email: string): Promise<boolean> => {
    const fifteenMinutesAgo = new Date(Date.now() - LOCKOUT_DURATION);

    const { data: recentAttempts } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('email', email)
      .eq('successful', false)
      .gte('attempt_time', fifteenMinutesAgo.toISOString())
      .order('attempt_time', { ascending: false });

    if (recentAttempts && recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      const oldestAttempt = recentAttempts[recentAttempts.length - 1];
      const lockoutEndTime = new Date(oldestAttempt.attempt_time).getTime() + LOCKOUT_DURATION;
      const timeRemaining = lockoutEndTime - Date.now();

      if (timeRemaining > 0) {
        setIsLockedOut(true);
        setLockoutTimeRemaining(timeRemaining);
        return false;
      }
    }

    return true;
  };

  const logLoginAttempt = async (email: string, successful: boolean) => {
    await supabase.from('login_attempts').insert({
      email,
      attempt_time: new Date().toISOString(),
      successful,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const canAttempt = await checkRateLimit(email);
        if (!canAttempt) {
          const minutes = Math.ceil(lockoutTimeRemaining / 60000);
          setError(`Too many failed login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`);
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          await logLoginAttempt(email, false);
          throw error;
        }
        await logLoginAttempt(email, true);
      } else {
        if (!name) {
          setError('Name is required for registration');
          setLoading(false);
          return;
        }
        if (inviteCode !== 'Evidentsales') {
          setError('Invalid invite code');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, name);
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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
            Evident Edge
          </h2>
          <p className="text-center text-slate-600 mb-8">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#adce60] focus:border-transparent transition-all"
                  placeholder="John Doe"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-slate-700 mb-2">
                  Invite Code
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#adce60] focus:border-transparent transition-all"
                  placeholder="Enter invite code"
                  required={!isLogin}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLockedOut}
              className="w-full bg-[#adce60] hover:bg-[#9bbf50] text-[#3c4f54] font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {loading ? 'Please wait...' : isLockedOut ? `Locked (${Math.ceil(lockoutTimeRemaining / 60000)}m)` : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-[#3c4f54] hover:text-[#adce60] font-medium transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
