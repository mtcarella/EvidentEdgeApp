import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Clock, Coffee, Timer, History, Utensils, Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface LunchSession {
  id?: string;
  employee_id: string;
  employee_name: string;
  clock_in: string;
  clock_out: string | null;
  duration_seconds: number | null;
}

function formatTime12(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getStartOfDayUTC(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

export function LunchClock() {
  const { salesPerson } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessions, setSessions] = useState<LunchSession[]>([]);
  const [activeSession, setActiveSession] = useState<LunchSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const employeeId = salesPerson?.id || '';
  const employeeName = salesPerson?.name || '';

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load today's sessions
  const loadSessions = useCallback(async () => {
    if (!employeeId) return;
    const { data, error } = await supabase
      .from('lunch_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('created_at', getStartOfDayUTC())
      .order('clock_in', { ascending: true });

    if (error) {
      console.error('Error loading lunch sessions:', error);
      return;
    }

    const todaySessions = data || [];
    setSessions(todaySessions);

    const open = todaySessions.find((s: LunchSession) => !s.clock_out);
    if (open) {
      setActiveSession(open);
      const start = new Date(open.clock_in).getTime();
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }
  }, [employeeId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Elapsed timer for active session
  useEffect(() => {
    if (activeSession) {
      timerRef.current = setInterval(() => {
        const start = new Date(activeSession.clock_in).getTime();
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  const notifyAdmins = async (action: 'clock_in' | 'clock_out', time: Date, durationSeconds?: number) => {
    const { data: admins } = await supabase
      .from('sales_people')
      .select('user_id')
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true);

    if (!admins || admins.length === 0) return;

    const timeStr = formatTime12(time);
    const durationStr = durationSeconds != null ? ` (${formatDuration(durationSeconds)})` : '';
    const message = action === 'clock_in'
      ? `${employeeName} clocked out for lunch at ${timeStr}`
      : `${employeeName} clocked back in from lunch at ${timeStr}${durationStr}`;

    const notifications = admins.map(a => ({
      user_id: a.user_id,
      message,
      type: 'lunch_clock',
      read: false,
      metadata: { employee_id: employeeId, employee_name: employeeName, action },
    }));

    const { error: notifError } = await supabase.from('notifications').insert(notifications);
    if (notifError) console.error('Error sending lunch notifications:', notifError);
  };

  const handleClockIn = async () => {
    if (!employeeId) return;
    setLoading(true);
    const now = new Date();

    const { data, error } = await supabase
      .from('lunch_sessions')
      .insert({
        employee_id: employeeId,
        employee_name: employeeName,
        clock_in: now.toISOString(),
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error clocking in:', error);
      setConfirmMessage('Failed to clock out. Please try again.');
    } else if (data) {
      setActiveSession(data);
      setConfirmMessage(`Lunch started at ${formatTime12(now)} — Don't forget to turn on your Out of Office email!`);
      setSessions(prev => [...prev, data]);
      await notifyAdmins('clock_in', now);
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!activeSession?.id) return;
    setLoading(true);
    const now = new Date();
    const start = new Date(activeSession.clock_in).getTime();
    const duration = Math.floor((now.getTime() - start) / 1000);

    const { data, error } = await supabase
      .from('lunch_sessions')
      .update({
        clock_out: now.toISOString(),
        duration_seconds: duration,
      })
      .eq('id', activeSession.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error clocking out:', error);
      setConfirmMessage('Failed to clock in. Please try again.');
    } else if (data) {
      setActiveSession(null);
      setConfirmMessage(`Welcome back! Clocked in at ${formatTime12(now)}`);
      setShowOOOOffReminder(true);
      setSessions(prev => prev.map(s => (s.id === data.id ? data : s)));
      await notifyAdmins('clock_out', now, duration);
    }
    setLoading(false);
  };

  const [showOOOOffReminder, setShowOOOOffReminder] = useState(false);

  const completedSessions = sessions.filter(s => s.clock_out);
  const dailyTotalSeconds = completedSessions.reduce(
    (sum, s) => sum + (s.duration_seconds || 0),
    0
  ) + (activeSession ? elapsedSeconds : 0);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Current Time Display */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 bg-slate-800 text-white px-8 py-4 rounded-2xl shadow-lg">
          <Clock className="w-6 h-6 text-slate-400" />
          <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Current Time</span>
        </div>
        <div className="mt-4 font-mono text-5xl md:text-6xl font-bold text-slate-800 tracking-widest">
          {formatTime12(currentTime)}
        </div>
      </div>

      {/* Active Timer Display */}
      {activeSession && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 mb-6 text-center animate-pulse-slow">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Coffee className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 uppercase tracking-wider">Lunch In Progress</span>
          </div>
          <div className="font-mono text-5xl md:text-6xl font-bold text-amber-700 tracking-widest my-4">
            {formatDuration(elapsedSeconds)}
          </div>
          <p className="text-amber-600 text-sm">
            Started at {formatTime12(new Date(activeSession.clock_in))}
          </p>
          <div className="mt-6 bg-red-50 border-2 border-red-300 rounded-2xl px-6 py-5 animate-pulse">
            <div className="flex items-center justify-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <span className="text-xl font-extrabold text-red-700 uppercase tracking-wide">Important Reminder</span>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex items-center justify-center gap-3">
              <Mail className="w-10 h-10 text-red-600 shrink-0" />
              <p className="text-lg font-bold text-red-800">Please turn on your Out of Office email before stepping away from your desk!</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Message */}
      {confirmMessage && (
        <div className={`text-center py-3 px-6 rounded-xl mb-6 font-medium text-sm ${
          confirmMessage.includes('Failed')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {confirmMessage}
        </div>
      )}

      {/* Turn OFF Out of Office Reminder (after clocking back in) */}
      {showOOOOffReminder && !activeSession && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-6 py-5 mb-6 animate-pulse">
          <div className="flex items-center justify-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <span className="text-xl font-extrabold text-red-700 uppercase tracking-wide">Important Reminder</span>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <div className="flex items-center justify-center gap-3">
            <Mail className="w-10 h-10 text-red-600 shrink-0" />
            <p className="text-lg font-bold text-red-800">Welcome back! Please turn OFF your Out of Office email now that you have returned.</p>
          </div>
          <button
            onClick={() => setShowOOOOffReminder(false)}
            className="mt-4 mx-auto block px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Got it, I turned it off
          </button>
        </div>
      )}

      {/* Clock Out (going to lunch) / Clock In (returning from lunch) Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={handleClockIn}
          disabled={!!activeSession || loading}
          className={`relative flex items-center justify-center gap-3 py-6 px-8 rounded-2xl text-2xl md:text-3xl font-bold transition-all duration-200 shadow-lg ${
            activeSession || loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white hover:shadow-xl'
          }`}
        >
          <Square className="w-8 h-8" />
          Clock Out
          {!activeSession && !loading && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping" />
          )}
        </button>

        <button
          onClick={handleClockOut}
          disabled={!activeSession || loading}
          className={`relative flex items-center justify-center gap-3 py-6 px-8 rounded-2xl text-2xl md:text-3xl font-bold transition-all duration-200 shadow-lg ${
            !activeSession || loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white hover:shadow-xl'
          }`}
        >
          <Play className="w-8 h-8" />
          Clock In
          {activeSession && !loading && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* Daily Total */}
      <div className="bg-slate-800 text-white rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Timer className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-slate-300">Daily Total Lunch Time</span>
        </div>
        <span className="font-mono text-2xl font-bold tracking-wider">
          {formatDuration(dailyTotalSeconds)}
        </span>
      </div>

      {/* Session History */}
      {completedSessions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-700">Today's Lunch Sessions</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {completedSessions.map((session, idx) => (
              <div key={session.id || idx} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Utensils className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {formatTime12(new Date(session.clock_in))}
                      <span className="text-slate-400 mx-2">-</span>
                      {session.clock_out ? formatTime12(new Date(session.clock_out)) : '---'}
                    </div>
                    <div className="text-xs text-slate-500">Session {idx + 1}</div>
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                  {session.duration_seconds ? formatDuration(session.duration_seconds) : '--:--:--'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && !activeSession && (
        <div className="text-center py-12 text-slate-400">
          <Coffee className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No lunch sessions recorded today</p>
        </div>
      )}
    </div>
  );
}
