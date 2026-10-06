import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, RefreshCw, Copy, SkipForward, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { DuplicateMatch, DuplicateAction } from './types';
import { CONTACT_FIELDS, COMPARABLE_FIELDS } from './types';

interface Props {
  duplicates: DuplicateMatch[];
  nonDuplicateCount: number;
  onDuplicatesChange: (duplicates: DuplicateMatch[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const ACTION_CONFIG: Record<DuplicateAction, {
  label: string;
  desc: string;
  icon: typeof RefreshCw;
  selected: string;
  iconSelected: string;
  checkColor: string;
}> = {
  replace: {
    label: 'Replace',
    desc: 'Merge selected fields into existing contact',
    icon: RefreshCw,
    selected: 'border-blue-500 bg-blue-50 ring-2 ring-blue-200',
    iconSelected: 'bg-blue-100 text-blue-600',
    checkColor: 'text-blue-500',
  },
  duplicate: {
    label: 'Import as New',
    desc: 'Create a separate new contact',
    icon: Copy,
    selected: 'border-amber-500 bg-amber-50 ring-2 ring-amber-200',
    iconSelected: 'bg-amber-100 text-amber-600',
    checkColor: 'text-amber-500',
  },
  skip: {
    label: 'Skip',
    desc: 'Do not import this contact',
    icon: SkipForward,
    selected: 'border-slate-500 bg-slate-50 ring-2 ring-slate-200',
    iconSelected: 'bg-slate-200 text-slate-600',
    checkColor: 'text-slate-500',
  },
};

function fieldLabel(key: string): string {
  return CONTACT_FIELDS.find(f => f.key === key)?.label || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function displayValue(val: any): string {
  if (val === null || val === undefined || val === '') return '-';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

export function StepDuplicates({ duplicates, nonDuplicateCount, onDuplicatesChange, onNext, onBack }: Props) {
  const [defaultAction, setDefaultAction] = useState<DuplicateAction>('replace');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const applyDefaultAction = (action: DuplicateAction) => {
    setDefaultAction(action);
    onDuplicatesChange(duplicates.map(d => ({ ...d, action, fieldsToReplace: action === 'replace' ? d.fieldsToReplace : new Set<string>() })));
  };

  const setAction = (idx: number, action: DuplicateAction) => {
    const next = [...duplicates];
    next[idx] = { ...next[idx], action, fieldsToReplace: action === 'replace' ? next[idx].fieldsToReplace : new Set<string>() };
    onDuplicatesChange(next);
  };

  const toggleField = (idx: number, field: string) => {
    const next = [...duplicates];
    const fields = new Set(next[idx].fieldsToReplace);
    if (fields.has(field)) fields.delete(field);
    else fields.add(field);
    next[idx] = { ...next[idx], fieldsToReplace: fields };
    onDuplicatesChange(next);
  };

  const selectAllFields = (idx: number) => {
    const next = [...duplicates];
    const d = next[idx];
    const diffFields = COMPARABLE_FIELDS.filter(f => {
      const incoming = displayValue(d.importRow[f]);
      const existing = displayValue(d.existing[f]);
      return incoming !== '-' && incoming !== existing;
    });
    next[idx] = { ...next[idx], fieldsToReplace: new Set(diffFields) };
    onDuplicatesChange(next);
  };

  const counts = useMemo(() => {
    const r = duplicates.filter(d => d.action === 'replace').length;
    const dup = duplicates.filter(d => d.action === 'duplicate').length;
    const s = duplicates.filter(d => d.action === 'skip').length;
    return { replace: r, duplicate: dup, skip: s };
  }, [duplicates]);

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''} detected
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Contacts matched by both name and email against your existing records.
              {nonDuplicateCount > 0 && ` ${nonDuplicateCount} new contact${nonDuplicateCount !== 1 ? 's' : ''} will import normally.`}
            </p>
          </div>
        </div>
      </div>

      {/* Default action selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Default action for all duplicates</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(ACTION_CONFIG) as DuplicateAction[]).map(action => {
            const a = ACTION_CONFIG[action];
            const Icon = a.icon;
            const isSelected = defaultAction === action;
            return (
              <button
                key={action}
                onClick={() => applyDefaultAction(action)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                  ${isSelected ? a.selected : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSelected ? a.iconSelected : 'bg-slate-100 text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>{a.label}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{a.desc}</p>
                </div>
                {isSelected && (
                  <Check className={`w-4 h-4 ml-auto ${a.checkColor} flex-shrink-0`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-center">
          <p className="text-lg font-bold text-blue-700">{counts.replace}</p>
          <p className="text-[10px] text-blue-600">Replace</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-center">
          <p className="text-lg font-bold text-amber-700">{counts.duplicate}</p>
          <p className="text-[10px] text-amber-600">Import as New</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-center">
          <p className="text-lg font-bold text-slate-600">{counts.skip}</p>
          <p className="text-[10px] text-slate-500">Skip</p>
        </div>
      </div>

      {/* Duplicate cards */}
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {duplicates.map((d, idx) => {
          const isExpanded = expandedIdx === idx;
          const diffFields = COMPARABLE_FIELDS.filter(f => {
            const incoming = displayValue(d.importRow[f]);
            const existing = displayValue(d.existing[f]);
            return incoming !== '-' && incoming !== existing;
          });

          return (
            <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Card header */}
              <div
                className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${d.action === 'replace' ? 'bg-blue-100 text-blue-700' : d.action === 'duplicate' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.importRow.name}</p>
                    <p className="text-xs text-slate-500 truncate">{d.importRow.email || 'No email'} &middot; {diffFields.length} field{diffFields.length !== 1 ? 's' : ''} differ</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <select
                    value={d.action}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setAction(idx, e.target.value as DuplicateAction)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                      ${d.action === 'replace' ? 'border-blue-300 bg-blue-50 text-blue-700' : d.action === 'duplicate' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                  >
                    <option value="replace">Replace</option>
                    <option value="duplicate">Import as New</option>
                    <option value="skip">Skip</option>
                  </select>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Expanded comparison */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4">
                  {d.action === 'replace' && diffFields.length > 0 && (
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-slate-500">Select fields to overwrite on the existing contact</p>
                      <button
                        onClick={() => selectAllFields(idx)}
                        className="text-[10px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        Select all different
                      </button>
                    </div>
                  )}

                  {d.action === 'skip' && (
                    <p className="text-sm text-slate-500 text-center py-4">This contact will not be imported.</p>
                  )}

                  {d.action === 'duplicate' && (
                    <p className="text-sm text-slate-500 text-center py-4">A new separate contact will be created with the imported data.</p>
                  )}

                  {d.action === 'replace' && (
                    <div className="space-y-1">
                      {/* Column headers */}
                      <div className="grid grid-cols-12 gap-2 px-2 pb-2 border-b border-slate-100">
                        {d.action === 'replace' && <div className="col-span-1" />}
                        <div className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Field</div>
                        <div className="col-span-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Existing</div>
                        <div className="col-span-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Incoming</div>
                      </div>

                      {COMPARABLE_FIELDS.map(field => {
                        const existVal = displayValue(d.existing[field]);
                        const importVal = displayValue(d.importRow[field]);
                        const isDiff = importVal !== '-' && importVal !== existVal;
                        const isChecked = d.fieldsToReplace.has(field);

                        if (!isDiff && importVal === '-') return null;

                        return (
                          <div
                            key={field}
                            onClick={() => isDiff && d.action === 'replace' ? toggleField(idx, field) : null}
                            className={`grid grid-cols-12 gap-2 px-2 py-2 rounded-lg transition-colors
                              ${isDiff && d.action === 'replace' ? 'cursor-pointer hover:bg-slate-50' : ''}
                              ${isChecked ? 'bg-blue-50/60' : ''}`}
                          >
                            <div className="col-span-1 flex items-center justify-center">
                              {isDiff && d.action === 'replace' && (
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                                  ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                  {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                              )}
                            </div>
                            <div className="col-span-3">
                              <span className="text-xs font-medium text-slate-600">{fieldLabel(field)}</span>
                            </div>
                            <div className="col-span-4">
                              <span className={`text-xs ${isDiff ? 'text-slate-500' : 'text-slate-400'}`}>
                                {existVal}
                              </span>
                            </div>
                            <div className="col-span-4">
                              <span className={`text-xs ${isDiff ? 'font-medium text-blue-700' : 'text-slate-400'}`}>
                                {importVal}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
