import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Columns, SkipForward, AlertTriangle, Check } from 'lucide-react';
import { CONTACT_FIELDS, autoDetectMapping } from './types';
import type { ParsedRow } from './types';

interface Props {
  columns: string[];
  rows: ParsedRow[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepMapping({ columns, rows, mapping, onMappingChange, onNext, onBack }: Props) {
  const [localMapping, setLocalMapping] = useState<Record<string, string>>(mapping);

  useEffect(() => {
    if (Object.keys(mapping).length === 0) {
      const auto = autoDetectMapping(columns);
      setLocalMapping(auto);
      onMappingChange(auto);
    }
  }, []);

  const usedFields = new Set(Object.values(localMapping).filter(v => v !== '_skip'));

  const handleChange = (col: string, field: string) => {
    const next = { ...localMapping };
    if (field === '_skip' || field === '') {
      delete next[col];
    } else {
      next[col] = field;
    }
    setLocalMapping(next);
    onMappingChange(next);
  };

  const hasName = Object.values(localMapping).includes('name');
  const hasType = Object.values(localMapping).includes('type');
  const canProceed = hasName && hasType;

  const getPreview = (col: string) => {
    return rows.slice(0, 3).map(r => r[col] || '').filter(Boolean);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">Map your file columns to contact fields</p>
        <p className="text-sm text-blue-700">
          We auto-detected matches where possible. Review and adjust, then continue.
          "Name" and "Type" are required.
        </p>
      </div>

      {!canProceed && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            You must map at least the <strong>Name</strong> and <strong>Type</strong> columns to continue.
          </p>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">File Column</div>
          <div className="col-span-3">Sample Values</div>
          <div className="col-span-1 flex items-center justify-center">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div className="col-span-4">Map To</div>
          <div className="col-span-1 text-center">Status</div>
        </div>

        <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          {columns.map(col => {
            const preview = getPreview(col);
            const mapped = localMapping[col] || '';
            const isMapped = mapped && mapped !== '_skip';

            return (
              <div
                key={col}
                className={`px-5 py-3.5 grid grid-cols-12 gap-4 items-center transition-colors
                  ${isMapped ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <Columns className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-800 truncate">{col}</span>
                  </div>
                </div>

                <div className="col-span-3">
                  <div className="flex flex-wrap gap-1">
                    {preview.length > 0 ? preview.map((v, i) => (
                      <span key={i} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs truncate max-w-[140px]">
                        {v}
                      </span>
                    )) : (
                      <span className="text-xs text-slate-400 italic">No data</span>
                    )}
                  </div>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>

                <div className="col-span-4">
                  <select
                    value={mapped}
                    onChange={e => handleChange(col, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                      ${isMapped ? 'border-emerald-300 bg-emerald-50/40 text-slate-800' : 'border-slate-200 text-slate-500'}`}
                  >
                    <option value="">-- Skip this column --</option>
                    {CONTACT_FIELDS.map(f => (
                      <option
                        key={f.key}
                        value={f.key}
                        disabled={usedFields.has(f.key) && localMapping[col] !== f.key}
                      >
                        {f.label}{f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  {isMapped ? (
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                      <SkipForward className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
