import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, CheckSquare, Square, ChevronsLeft, ChevronsRight, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ImportRow } from './types';
import { normalizeType } from './types';

const VALID_TYPES = ['buyer', 'realtor', 'attorney', 'loan_officer', 'vendor'];
const PAGE_SIZE = 50;

interface Props {
  rows: ImportRow[];
  visibleColumns: string[];
  defaultSalesperson: string;
  defaultBranch: string;
  onRowsChange: (rows: ImportRow[]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Salesperson { id: string; name: string; }

export function StepPreview({ rows, visibleColumns, defaultSalesperson, defaultBranch, onRowsChange, onNext, onBack }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [editCell, setEditCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);

  useEffect(() => {
    supabase.from('sales_people').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setSalespeople(data || []));
  }, []);

  const spMap = useMemo(() => new Map(salespeople.map(s => [s.id, s.name])), [salespeople]);

  const displayCols = useMemo(() => {
    const base = visibleColumns.filter(c => c !== '_salesperson' && c !== '_branch');
    return [...base, '_salesperson', '_branch'];
  }, [visibleColumns]);

  const selectedCount = rows.filter(r => r._selected).length;
  const allSelected = selectedCount === rows.length;

  const toggleAll = () => {
    const val = !allSelected;
    onRowsChange(rows.map(r => ({ ...r, _selected: val })));
  };

  const toggleRow = (idx: number) => {
    const next = [...rows];
    next[idx] = { ...next[idx], _selected: !next[idx]._selected };
    onRowsChange(next);
  };

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = String(a[sortCol] ?? '').toLowerCase();
      const vb = String(b[sortCol] ?? '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return copy;
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showPagination = sorted.length > PAGE_SIZE;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const commitEdit = () => {
    if (!editCell) return;
    const realIdx = rows.findIndex(r => r._rowIndex === paged[editCell.row]._rowIndex);
    if (realIdx < 0) return;
    const next = [...rows];
    next[realIdx] = { ...next[realIdx], [editCell.col]: editValue };
    next[realIdx]._warnings = computeWarnings(next[realIdx]);
    onRowsChange(next);
    setEditCell(null);
  };

  const startEdit = (pageRowIdx: number, col: string) => {
    setEditCell({ row: pageRowIdx, col });
    setEditValue(String(paged[pageRowIdx][col] ?? ''));
  };

  const colLabel = (col: string) => {
    if (col === '_salesperson') return 'Salesperson';
    if (col === '_branch') return 'Branch';
    return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const warningRows = rows.filter(r => r._selected && r._warnings.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-700">
            <span className="text-blue-600 font-bold">{selectedCount}</span> of {rows.length} rows selected for import
          </span>
          {warningRows > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {warningRows} with warnings
            </span>
          )}
        </div>
        {sorted.length > 1000 && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Large file: {sorted.length.toLocaleString()} rows
          </span>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <button onClick={toggleAll} className="text-slate-500 hover:text-slate-700">
                    {allSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
                {displayCols.map(col => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 whitespace-nowrap select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {colLabel(col)}
                      {sortCol === col && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((row, pageIdx) => {
                const hasWarning = row._selected && row._warnings.length > 0;
                return (
                  <tr
                    key={row._rowIndex}
                    className={`transition-colors ${!row._selected ? 'opacity-40 bg-slate-50' : hasWarning ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      <button onClick={() => toggleRow(rows.findIndex(r => r._rowIndex === row._rowIndex))} className="text-slate-500 hover:text-slate-700">
                        {row._selected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{row._rowIndex + 1}</td>
                    {displayCols.map(col => {
                      const isEditing = editCell?.row === pageIdx && editCell?.col === col;
                      const val = row[col] ?? '';

                      if (col === '_salesperson' && isEditing) {
                        return (
                          <td key={col} className="px-3 py-1.5">
                            <select
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              autoFocus
                              className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="">-- None --</option>
                              {salespeople.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </td>
                        );
                      }

                      if (col === '_salesperson') {
                        return (
                          <td key={col} className="px-3 py-2.5 cursor-pointer group" onClick={() => startEdit(pageIdx, col)}>
                            <span className="inline-flex items-center gap-1 text-xs">
                              {val ? spMap.get(val) || val : <span className="text-slate-400 italic">None</span>}
                              <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </td>
                        );
                      }

                      if (isEditing) {
                        return (
                          <td key={col} className="px-3 py-1.5">
                            <input
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null); }}
                              autoFocus
                              className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                        );
                      }

                      const isMissing = (col === 'name' && !val) || (col === 'type' && !VALID_TYPES.includes(normalizeType(val)));

                      return (
                        <td
                          key={col}
                          className="px-3 py-2.5 cursor-pointer group max-w-[200px]"
                          onClick={() => startEdit(pageIdx, col)}
                        >
                          <span className={`inline-flex items-center gap-1 text-xs truncate ${isMissing ? 'text-red-600 font-medium' : 'text-slate-700'}`}>
                            {val || (isMissing ? 'Required' : <span className="text-slate-300">-</span>)}
                            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} ({sorted.length.toLocaleString()} rows)
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronsLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedCount === 0}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Review & Import <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function computeWarnings(row: ImportRow): string[] {
  const w: string[] = [];
  if (!row.name) w.push('Name is missing');
  if (row.type) {
    const nt = normalizeType(row.type);
    if (!VALID_TYPES.includes(nt)) w.push(`Invalid type: "${row.type}"`);
  } else {
    w.push('Type is missing');
  }
  return w;
}
