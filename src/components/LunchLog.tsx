import { useState, useEffect, useCallback } from 'react';
import { Coffee, Calendar, Clock, Users, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight, Download, BarChart3, Utensils, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LunchSession {
  id: string;
  employee_id: string;
  employee_name: string;
  clock_in: string;
  clock_out: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
  lunch_required: boolean;
}

type ViewMode = 'daily' | 'weekly';

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

function formatDateLocal(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateRangeForDay(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekRange(monday: Date): { start: string; end: string; days: Date[] } {
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const endDate = new Date(monday);
  endDate.setDate(monday.getDate() + 5);
  return { start: start.toISOString(), end: endDate.toISOString(), days };
}

function getDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function LunchLog() {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [sessions, setSessions] = useState<LunchSession[]>([]);
  const [weeklySessions, setWeeklySessions] = useState<LunchSession[]>([]);
  const [requiredEmployees, setRequiredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [activeSessions, setActiveSessions] = useState<LunchSession[]>([]);

  const loadActiveSessions = useCallback(async () => {
    const { data } = await supabase
      .from('lunch_sessions')
      .select('*')
      .is('clock_out', null)
      .order('clock_in', { ascending: true });
    setActiveSessions(data || []);
  }, []);

  const loadRequiredEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name, lunch_required')
      .eq('is_active', true)
      .order('name');
    setAllEmployees(data || []);
    setRequiredEmployees((data || []).filter((e: Employee) => e.lunch_required));
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { start, end } = getDateRangeForDay(selectedDate);
    const { data, error } = await supabase
      .from('lunch_sessions')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('employee_name', { ascending: true })
      .order('clock_in', { ascending: true });

    if (error) {
      console.error('Error loading lunch sessions:', error);
    }
    setSessions(data || []);
    setLoading(false);
  }, [selectedDate]);

  const loadWeeklySessions = useCallback(async () => {
    setLoading(true);
    const { start, end } = getWeekRange(weekStart);
    const { data, error } = await supabase
      .from('lunch_sessions')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('employee_name', { ascending: true })
      .order('clock_in', { ascending: true });

    if (error) {
      console.error('Error loading weekly lunch sessions:', error);
    }
    setWeeklySessions(data || []);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    loadRequiredEmployees();
    loadActiveSessions();
    const channel = supabase
      .channel('lunch-log-active')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lunch_sessions' }, () => {
        loadActiveSessions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRequiredEmployees, loadActiveSessions]);

  useEffect(() => {
    if (viewMode === 'daily') loadSessions();
  }, [loadSessions, viewMode]);

  useEffect(() => {
    if (viewMode === 'weekly') loadWeeklySessions();
  }, [loadWeeklySessions, viewMode]);

  const toggleLunchRequired = async (employeeId: string, currentValue: boolean) => {
    setToggling(employeeId);
    const { error } = await supabase
      .from('sales_people')
      .update({ lunch_required: !currentValue })
      .eq('id', employeeId);

    if (!error) {
      await loadRequiredEmployees();
    }
    setToggling(null);
  };

  const changeDate = (delta: number) => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const changeWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setWeekStart(getMonday(now));
  };

  // Daily view data
  const sessionsByEmployee = new Map<string, LunchSession[]>();
  sessions.forEach(s => {
    const list = sessionsByEmployee.get(s.employee_id) || [];
    list.push(s);
    sessionsByEmployee.set(s.employee_id, list);
  });

  const requiredWithStatus = requiredEmployees.map(emp => {
    const empSessions = sessionsByEmployee.get(emp.id) || [];
    const totalSeconds = empSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const hasClockedIn = empSessions.length > 0;
    return { ...emp, sessions: empSessions, totalSeconds, hasClockedIn };
  });

  const allEmployeeSessions = Array.from(sessionsByEmployee.entries())
    .filter(([empId]) => !requiredEmployees.some(r => r.id === empId))
    .map(([empId, empSessions]) => ({
      employeeId: empId,
      employeeName: empSessions[0]?.employee_name || 'Unknown',
      sessions: empSessions,
      totalSeconds: empSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0),
    }));

  // Weekly view data
  const { days: weekDays } = getWeekRange(weekStart);

  const weeklyByEmployee = new Map<string, { name: string; dayTotals: Map<string, number>; dayCount: Map<string, number> }>();
  weeklySessions.forEach(s => {
    if (!weeklyByEmployee.has(s.employee_id)) {
      weeklyByEmployee.set(s.employee_id, { name: s.employee_name, dayTotals: new Map(), dayCount: new Map() });
    }
    const emp = weeklyByEmployee.get(s.employee_id)!;
    const dayKey = new Date(s.created_at).toLocaleDateString('en-US');
    emp.dayTotals.set(dayKey, (emp.dayTotals.get(dayKey) || 0) + (s.duration_seconds || 0));
    emp.dayCount.set(dayKey, (emp.dayCount.get(dayKey) || 0) + 1);
  });

  const weeklyRows = requiredEmployees.map(emp => {
    const data = weeklyByEmployee.get(emp.id);
    const dayData = weekDays.map(day => {
      const key = day.toLocaleDateString('en-US');
      return {
        date: day,
        totalSeconds: data?.dayTotals.get(key) || 0,
        sessionCount: data?.dayCount.get(key) || 0,
      };
    });
    const weekTotal = dayData.reduce((sum, d) => sum + d.totalSeconds, 0);
    const daysLogged = dayData.filter(d => d.sessionCount > 0).length;
    return { ...emp, dayData, weekTotal, daysLogged };
  });

  const otherWeeklyRows = Array.from(weeklyByEmployee.entries())
    .filter(([empId]) => !requiredEmployees.some(r => r.id === empId))
    .map(([empId, empData]) => {
      const dayData = weekDays.map(day => {
        const key = day.toLocaleDateString('en-US');
        return {
          date: day,
          totalSeconds: empData.dayTotals.get(key) || 0,
          sessionCount: empData.dayCount.get(key) || 0,
        };
      });
      const weekTotal = dayData.reduce((sum, d) => sum + d.totalSeconds, 0);
      const daysLogged = dayData.filter(d => d.sessionCount > 0).length;
      return { id: empId, name: empData.name, dayData, weekTotal, daysLogged };
    });

  const isToday = (() => {
    const now = new Date();
    return selectedDate.getFullYear() === now.getFullYear()
      && selectedDate.getMonth() === now.getMonth()
      && selectedDate.getDate() === now.getDate();
  })();

  const isCurrentWeek = (() => {
    const currentMonday = getMonday(new Date());
    return weekStart.getTime() === currentMonday.getTime();
  })();

  const exportDailyCSV = () => {
    const rows: string[][] = [['Employee', 'Required', 'Clock In', 'Clock Out', 'Duration']];
    requiredWithStatus.forEach(emp => {
      if (emp.sessions.length === 0) {
        rows.push([emp.name, 'Yes', 'No sessions', '', '']);
      } else {
        emp.sessions.forEach(s => {
          rows.push([
            emp.name,
            'Yes',
            formatTime12(new Date(s.clock_in)),
            s.clock_out ? formatTime12(new Date(s.clock_out)) : 'In Progress',
            s.duration_seconds ? formatDuration(s.duration_seconds) : '--',
          ]);
        });
      }
    });
    allEmployeeSessions.forEach(emp => {
      emp.sessions.forEach(s => {
        rows.push([
          emp.employeeName,
          'No',
          formatTime12(new Date(s.clock_in)),
          s.clock_out ? formatTime12(new Date(s.clock_out)) : 'In Progress',
          s.duration_seconds ? formatDuration(s.duration_seconds) : '--',
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadCSV(csv, `lunch-log-${selectedDate.toISOString().slice(0, 10)}.csv`);
  };

  const exportWeeklyCSV = () => {
    const header = ['Employee', 'Required', ...weekDays.map(d => getDayLabel(d) + ' ' + formatDateShort(d)), 'Weekly Total', 'Days Logged'];
    const rows: string[][] = [header];
    weeklyRows.forEach(emp => {
      rows.push([
        emp.name,
        'Yes',
        ...emp.dayData.map(d => d.totalSeconds > 0 ? formatDuration(d.totalSeconds) : '--'),
        formatDuration(emp.weekTotal),
        `${emp.daysLogged}/5`,
      ]);
    });
    otherWeeklyRows.forEach(emp => {
      rows.push([
        emp.name,
        'No',
        ...emp.dayData.map(d => d.totalSeconds > 0 ? formatDuration(d.totalSeconds) : '--'),
        formatDuration(emp.weekTotal),
        `${emp.daysLogged}/5`,
      ]);
    });
    const fridayDate = weekDays[4];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadCSV(csv, `lunch-weekly-${weekStart.toISOString().slice(0, 10)}-to-${fridayDate.toISOString().slice(0, 10)}.csv`);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDurationCompact = (seconds: number): string => {
    if (seconds === 0) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Currently Out to Lunch Banner */}
      {activeSessions.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Utensils className="w-6 h-6 text-amber-600" />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-amber-50 animate-pulse">
                {activeSessions.length}
              </span>
            </div>
            <h3 className="text-lg font-bold text-amber-800">Currently Out to Lunch</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSessions.map(s => {
              const startTime = new Date(s.clock_in);
              const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
              const mins = Math.floor(elapsed / 60);
              const isLong = mins >= 60;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border ${
                    isLong ? 'border-red-300 bg-red-50/50' : 'border-amber-200'
                  } shadow-sm`}
                >
                  <div className={`w-3 h-3 rounded-full animate-pulse flex-shrink-0 ${
                    isLong ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 text-sm truncate">{s.employee_name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Timer className="w-3 h-3" />
                      <span>Since {formatTime12(startTime)}</span>
                      <span className={`font-bold ml-1 ${
                        isLong ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        ({mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Coffee className="w-6 h-6 text-amber-600" />
          <h2 className="text-xl font-bold text-slate-800">Lunch Log</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'daily'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Daily
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'weekly'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Weekly
            </button>
          </div>

          {/* Date navigation */}
          <button
            onClick={() => viewMode === 'daily' ? changeDate(-1) : changeWeek(-1)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              (viewMode === 'daily' && isToday) || (viewMode === 'weekly' && isCurrentWeek)
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {viewMode === 'daily'
                ? (isToday ? 'Today' : formatDateLocal(selectedDate.toISOString()))
                : (isCurrentWeek
                    ? 'This Week'
                    : `${formatDateShort(weekStart)} - ${formatDateShort(weekDays[4])}`)
              }
            </div>
          </button>
          <button
            onClick={() => viewMode === 'daily' ? changeDate(1) : changeWeek(1)}
            disabled={viewMode === 'daily' ? isToday : isCurrentWeek}
            className={`p-2 rounded-lg transition-colors ${
              (viewMode === 'daily' ? isToday : isCurrentWeek)
                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (viewMode === 'daily') { loadSessions(); loadRequiredEmployees(); }
              else { loadWeeklySessions(); loadRequiredEmployees(); }
            }}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={viewMode === 'daily' ? exportDailyCSV : exportWeeklyCSV}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Manage required users */}
      <div>
        <button
          onClick={() => setShowManage(!showManage)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Users className="w-4 h-4" />
          {showManage ? 'Hide' : 'Manage'} Required Users ({requiredEmployees.length})
        </button>

        {showManage && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-3">
              Toggle which employees are required to log lunch daily. Required users who haven't clocked in will appear highlighted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => toggleLunchRequired(emp.id, emp.lunch_required)}
                  disabled={toggling === emp.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    emp.lunch_required
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  } ${toggling === emp.id ? 'opacity-50' : ''}`}
                >
                  {emp.lunch_required
                    ? <CheckCircle className="w-4 h-4 text-amber-600" />
                    : <XCircle className="w-4 h-4 text-slate-400" />
                  }
                  {emp.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== WEEKLY VIEW ==================== */}
      {viewMode === 'weekly' && (
        <>
          {/* Weekly summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">{requiredEmployees.length}</div>
              <div className="text-xs text-slate-500 mt-1">Required Users</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {weeklyRows.filter(r => r.daysLogged === 5).length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Full Week (5/5)</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {weeklyRows.filter(r => r.daysLogged > 0 && r.daysLogged < 5).length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Partial Week</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-500">
                {weeklyRows.filter(r => r.daysLogged === 0).length}
              </div>
              <div className="text-xs text-slate-500 mt-1">No Lunches</div>
            </div>
          </div>

          {/* Weekly table - required users */}
          {requiredEmployees.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Required Users — Week of {formatDateShort(weekStart)}
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                        {weekDays.map(day => (
                          <th key={day.toISOString()} className="text-center px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            {getDayLabel(day)}<br />
                            <span className="font-normal text-slate-400">{formatDateShort(day)}</span>
                          </th>
                        ))}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {weeklyRows.map(emp => (
                        <tr key={emp.id} className={emp.daysLogged === 0 ? 'bg-red-50/50' : ''}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                emp.daysLogged === 5 ? 'bg-emerald-500' :
                                emp.daysLogged > 0 ? 'bg-amber-400' : 'bg-red-400'
                              }`} />
                              <span className="font-medium text-slate-800 text-sm">{emp.name}</span>
                            </div>
                          </td>
                          {emp.dayData.map((day, idx) => (
                            <td key={idx} className="text-center px-3 py-3">
                              {day.sessionCount > 0 ? (
                                <div>
                                  <span className="text-sm font-medium text-slate-700">{formatDurationCompact(day.totalSeconds)}</span>
                                  {day.sessionCount > 1 && (
                                    <span className="block text-[10px] text-slate-400">{day.sessionCount} sessions</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-sm">--</span>
                              )}
                            </td>
                          ))}
                          <td className="text-center px-4 py-3">
                            <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {formatDurationCompact(emp.weekTotal)}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              emp.daysLogged === 5 ? 'bg-emerald-100 text-emerald-700' :
                              emp.daysLogged > 0 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {emp.daysLogged}/5
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Other users weekly */}
          {otherWeeklyRows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Other Users
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                        {weekDays.map(day => (
                          <th key={day.toISOString()} className="text-center px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            {getDayLabel(day)}<br />
                            <span className="font-normal text-slate-400">{formatDateShort(day)}</span>
                          </th>
                        ))}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {otherWeeklyRows.map(emp => (
                        <tr key={emp.id}>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800 text-sm">{emp.name}</span>
                          </td>
                          {emp.dayData.map((day, idx) => (
                            <td key={idx} className="text-center px-3 py-3">
                              {day.sessionCount > 0 ? (
                                <span className="text-sm font-medium text-slate-700">{formatDurationCompact(day.totalSeconds)}</span>
                              ) : (
                                <span className="text-slate-300 text-sm">--</span>
                              )}
                            </td>
                          ))}
                          <td className="text-center px-4 py-3">
                            <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {formatDurationCompact(emp.weekTotal)}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className="text-xs font-bold text-slate-500">{emp.daysLogged}/5</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {weeklySessions.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400">
              <Coffee className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No lunch sessions recorded for the week of {formatDateShort(weekStart)}</p>
            </div>
          )}
        </>
      )}

      {/* ==================== DAILY VIEW ==================== */}
      {viewMode === 'daily' && (
        <>
          {/* Required users section */}
          {requiredEmployees.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Required Users — {formatDateLocal(selectedDate.toISOString())}
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  {requiredWithStatus.map(emp => (
                    <div
                      key={emp.id}
                      className={`px-5 py-4 ${!emp.hasClockedIn ? 'bg-red-50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${emp.hasClockedIn ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          <span className="font-semibold text-slate-800">{emp.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {emp.hasClockedIn ? (
                            <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Logged
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-100 px-3 py-1 rounded-full border border-red-200">
                              <XCircle className="w-3.5 h-3.5" />
                              Not Logged
                            </span>
                          )}
                          {emp.totalSeconds > 0 && (
                            <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                              {formatDuration(emp.totalSeconds)}
                            </span>
                          )}
                        </div>
                      </div>
                      {emp.sessions.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {emp.sessions.map((s, idx) => (
                            <div key={s.id} className="flex items-center gap-3 text-sm text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {formatTime12(new Date(s.clock_in))}
                                <span className="text-slate-400 mx-1">-</span>
                                {s.clock_out ? formatTime12(new Date(s.clock_out)) : (
                                  <span className="text-amber-600 font-medium">In Progress</span>
                                )}
                              </span>
                              {s.duration_seconds != null && (
                                <span className="text-slate-500">({formatDuration(s.duration_seconds)})</span>
                              )}
                              {emp.sessions.length > 1 && (
                                <span className="text-slate-400 text-xs">Session {idx + 1}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Other users who clocked in */}
          {allEmployeeSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Other Users
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  {allEmployeeSessions.map(emp => (
                    <div key={emp.employeeId} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-800">{emp.employeeName}</span>
                        <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                          {formatDuration(emp.totalSeconds)}
                        </span>
                      </div>
                      <div className="ml-1 space-y-1">
                        {emp.sessions.map((s, idx) => (
                          <div key={s.id} className="flex items-center gap-3 text-sm text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {formatTime12(new Date(s.clock_in))}
                              <span className="text-slate-400 mx-1">-</span>
                              {s.clock_out ? formatTime12(new Date(s.clock_out)) : (
                                <span className="text-amber-600 font-medium">In Progress</span>
                              )}
                            </span>
                            {s.duration_seconds != null && (
                              <span className="text-slate-500">({formatDuration(s.duration_seconds)})</span>
                            )}
                            {emp.sessions.length > 1 && (
                              <span className="text-slate-400 text-xs">Session {idx + 1}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {sessions.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400">
              <Coffee className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No lunch sessions recorded for {formatDateLocal(selectedDate.toISOString())}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
