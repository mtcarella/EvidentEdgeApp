import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Users, Building2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  defaultSalesperson: string;
  defaultBranch: string;
  onDefaultsChange: (sp: string, branch: string) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Salesperson {
  id: string;
  name: string;
}

export function StepDefaults({ defaultSalesperson, defaultBranch, onDefaultsChange, onNext, onBack }: Props) {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sp, setSp] = useState(defaultSalesperson);
  const [branch, setBranch] = useState(defaultBranch);

  useEffect(() => {
    (async () => {
      const [spRes, branchRes] = await Promise.all([
        supabase.from('sales_people').select('id, name').eq('is_active', true).order('name'),
        supabase.from('contacts').select('branch').not('branch', 'is', null).limit(1000),
      ]);

      setSalespeople(spRes.data || []);

      const unique = new Set<string>();
      (branchRes.data || []).forEach(r => {
        if (r.branch) unique.add(r.branch);
      });
      setBranches(Array.from(unique).sort());
      setLoading(false);
    })();
  }, []);

  const handleSpChange = (val: string) => {
    setSp(val);
    onDefaultsChange(val, branch);
  };

  const handleBranchChange = (val: string) => {
    setBranch(val);
    onDefaultsChange(sp, val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading team data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">Set default assignment for imported contacts</p>
        <p className="text-sm text-blue-700">
          These defaults will apply to all rows. You can override them per row in the next step.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Default Salesperson</h3>
              <p className="text-xs text-slate-500">Assign all imported contacts to this salesperson</p>
            </div>
          </div>
          <select
            value={sp}
            onChange={e => handleSpChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          >
            <option value="">-- None (leave unassigned) --</option>
            {salespeople.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Default Branch</h3>
              <p className="text-xs text-slate-500">Assign all imported contacts to this branch</p>
            </div>
          </div>
          <select
            value={branch}
            onChange={e => handleBranchChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          >
            <option value="">-- None --</option>
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
        >
          Continue to Preview <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
