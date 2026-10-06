import { useState, useMemo } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Loader2, Upload, RotateCcw, RefreshCw, Copy, SkipForward } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { ImportRow, DuplicateMatch } from './types';
import { normalizeType, normalizeBoolean } from './types';

const VALID_TYPES = ['buyer', 'realtor', 'attorney', 'loan_officer', 'vendor'];

interface Props {
  rows: ImportRow[];
  duplicates: DuplicateMatch[];
  defaultSalesperson: string;
  defaultBranch: string;
  onBack: () => void;
  onReset: () => void;
}

interface ResultState {
  total: number;
  success: number;
  replaced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

function buildContactData(row: ImportRow, salespersonId: string | null, branch: string | null, userId: string | undefined): Record<string, any> {
  const name = String(row.name || '').trim();
  const type = normalizeType(String(row.type || '').trim());

  const data: Record<string, any> = {
    name,
    type,
    email: row.email || null,
    phone: row.phone || null,
    cell_phone: row.cell_phone || null,
    company: row.company || null,
    branch: branch || null,
    address: row.address || null,
    notes: row.notes || null,
    processor_notes: row.processor_notes || null,
    birthday: row.birthday || null,
    preferred_surveyor: row.preferred_surveyor || null,
    preferred_uw: row.preferred_uw || null,
    preferred_closer: row.preferred_closer || null,
    client_identifier_no: row.client_identifier_no || null,
    assigned_to: salespersonId,
    created_by: userId,
    updated_by: userId,
  };

  if (row.client_type) {
    const ct = row.client_type.toLowerCase().trim();
    if (ct === 'client' || ct === 'prospect') data.client_type = ct;
  }
  if (row.grade) {
    const g = row.grade.toUpperCase().trim();
    if (['A', 'B', 'C'].includes(g)) data.grade = g;
  }
  if (row.drinks !== undefined && row.drinks !== '') {
    const d = normalizeBoolean(String(row.drinks));
    if (d !== undefined) data.drinks = d;
  }

  return data;
}

export function StepConfirm({ rows, duplicates, defaultSalesperson, defaultBranch, onBack, onReset }: Props) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ResultState | null>(null);

  const dupeIndices = useMemo(() => new Set(duplicates.map(d => d.importRow._rowIndex)), [duplicates]);
  const newRows = useMemo(() => rows.filter(r => r._selected && !dupeIndices.has(r._rowIndex)), [rows, dupeIndices]);
  const replaceCount = duplicates.filter(d => d.action === 'replace').length;
  const dupeAsNew = duplicates.filter(d => d.action === 'duplicate').length;
  const skipCount = duplicates.filter(d => d.action === 'skip').length;
  const totalToProcess = newRows.length + replaceCount + dupeAsNew;

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);

    const results: ResultState = { total: totalToProcess, success: 0, replaced: 0, failed: 0, skipped: skipCount, errors: [] };

    const { data: spData } = await supabase.from('sales_people').select('id, name').eq('is_active', true);
    const spIdSet = new Set((spData || []).map(s => s.id));

    let processed = 0;
    const totalSteps = totalToProcess;

    const tick = () => {
      processed++;
      setProgress(Math.round((processed / totalSteps) * 100));
    };

    // 1) Handle duplicate replacements
    for (const d of duplicates) {
      if (d.action === 'skip') continue;

      if (d.action === 'replace') {
        try {
          if (d.fieldsToReplace.size === 0) {
            results.skipped++;
            tick();
            continue;
          }

          const updateData: Record<string, any> = { updated_by: user?.id };
          for (const field of d.fieldsToReplace) {
            const val = d.importRow[field];
            if (field === 'drinks') {
              const b = normalizeBoolean(String(val));
              if (b !== undefined) updateData[field] = b;
            } else if (field === 'client_type') {
              const ct = String(val).toLowerCase().trim();
              if (ct === 'client' || ct === 'prospect') updateData[field] = ct;
            } else if (field === 'grade') {
              const g = String(val).toUpperCase().trim();
              if (['A', 'B', 'C'].includes(g)) updateData[field] = g;
            } else {
              updateData[field] = val || null;
            }
          }

          const { error } = await supabase
            .from('contacts')
            .update(updateData)
            .eq('id', d.existing.id);

          if (error) throw error;
          results.replaced++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Replace "${d.importRow.name}": ${err.message}`);
        }
        tick();
        continue;
      }

      // action === 'duplicate': insert as new
      try {
        const salespersonId = d.importRow._salesperson || defaultSalesperson || null;
        if (salespersonId && !spIdSet.has(salespersonId)) {
          results.failed++;
          results.errors.push(`Duplicate-as-new "${d.importRow.name}": Invalid salesperson`);
          tick();
          continue;
        }

        const branch = d.importRow._branch || defaultBranch || null;
        const insertData = buildContactData(d.importRow, salespersonId, branch, user?.id);

        const { data: newContact, error: contactErr } = await supabase
          .from('contacts')
          .insert(insertData)
          .select('id')
          .single();

        if (contactErr) throw contactErr;

        if (newContact && salespersonId) {
          await supabase.from('assignments').insert({
            contact_id: newContact.id,
            salesperson_id: salespersonId,
            assigned_by: user?.id,
          });
        }

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Duplicate-as-new "${d.importRow.name}": ${err.message}`);
      }
      tick();
    }

    // 2) Handle new (non-duplicate) rows
    for (const row of newRows) {
      try {
        const name = String(row.name || '').trim();
        const rawType = String(row.type || '').trim();
        const type = normalizeType(rawType);

        if (!name) {
          results.failed++;
          results.errors.push(`Row ${row._rowIndex + 1}: Name is missing`);
          tick();
          continue;
        }
        if (!VALID_TYPES.includes(type)) {
          results.failed++;
          results.errors.push(`Row ${row._rowIndex + 1} "${name}": Invalid type "${rawType}"`);
          tick();
          continue;
        }

        const salespersonId = row._salesperson || defaultSalesperson || null;
        if (salespersonId && !spIdSet.has(salespersonId)) {
          results.failed++;
          results.errors.push(`Row ${row._rowIndex + 1} "${name}": Invalid salesperson`);
          tick();
          continue;
        }

        const branch = row._branch || defaultBranch || null;
        const insertData = buildContactData(row, salespersonId, branch, user?.id);

        const { data: newContact, error: contactErr } = await supabase
          .from('contacts')
          .insert(insertData)
          .select('id')
          .single();

        if (contactErr) throw contactErr;

        if (newContact && salespersonId) {
          await supabase.from('assignments').insert({
            contact_id: newContact.id,
            salesperson_id: salespersonId,
            assigned_by: user?.id,
          });
        }

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${row._rowIndex + 1} "${row.name}": ${err.message}`);
      }
      tick();
    }

    setResult(results);
    setImporting(false);
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-xl flex-1 min-w-[140px]">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-emerald-800">{result.success}</p>
              <p className="text-xs text-emerald-600">New imports</p>
            </div>
          </div>
          {result.replaced > 0 && (
            <div className="flex items-center gap-2 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl flex-1 min-w-[140px]">
              <RefreshCw className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-800">{result.replaced}</p>
                <p className="text-xs text-blue-600">Updated (merged)</p>
              </div>
            </div>
          )}
          {result.skipped > 0 && (
            <div className="flex items-center gap-2 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl flex-1 min-w-[140px]">
              <SkipForward className="w-6 h-6 text-slate-500" />
              <div>
                <p className="text-2xl font-bold text-slate-600">{result.skipped}</p>
                <p className="text-xs text-slate-500">Skipped</p>
              </div>
            </div>
          )}
          {result.failed > 0 && (
            <div className="flex items-center gap-2 px-5 py-4 bg-red-50 border border-red-200 rounded-xl flex-1 min-w-[140px]">
              <XCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-800">{result.failed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>
          )}
        </div>

        {result.errors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 max-h-64 overflow-y-auto">
            <p className="text-sm font-semibold text-amber-900 mb-3">Issues ({result.errors.length}):</p>
            <ul className="text-xs text-amber-800 space-y-1.5 font-mono">
              {result.errors.map((e, i) => (
                <li key={i} className="border-l-2 border-amber-300 pl-3 py-1">{e}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Import Another File
        </button>
      </div>
    );
  }

  if (importing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-slate-600 font-medium">Importing contacts...</p>
        <div className="w-64 bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-500">{progress}% complete</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">Ready to import</p>
        <p className="text-sm text-blue-700">Review the summary below and confirm.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{newRows.length}</p>
          <p className="text-xs text-slate-500 mt-1">New contacts</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-2xl font-bold text-blue-700">{replaceCount}</p>
          </div>
          <p className="text-xs text-blue-500 mt-1">Replace (merge)</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Copy className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-2xl font-bold text-amber-700">{dupeAsNew}</p>
          </div>
          <p className="text-xs text-amber-500 mt-1">Import as new</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <SkipForward className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-2xl font-bold text-slate-500">{skipCount}</p>
          </div>
          <p className="text-xs text-slate-400 mt-1">Skip</p>
        </div>
      </div>

      {newRows.some(r => r._warnings.length > 0) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              {newRows.filter(r => r._warnings.length > 0).length} row{newRows.filter(r => r._warnings.length > 0).length > 1 ? 's have' : ' has'} missing required fields
            </p>
            <p className="text-xs text-amber-700 mt-1">These rows will be skipped during import unless you go back and fix them.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={totalToProcess === 0}
            className="flex items-center gap-2 px-8 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
}
