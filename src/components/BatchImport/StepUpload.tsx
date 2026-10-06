import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ParsedRow } from './types';

interface Props {
  onParsed: (columns: string[], rows: ParsedRow[]) => void;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || '';
  const candidates: [string, number][] = [
    ['\t', (firstLine.match(/\t/g) || []).length],
    [',', (firstLine.match(/,/g) || []).length],
    [';', (firstLine.match(/;/g) || []).length],
    ['|', (firstLine.match(/\|/g) || []).length],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : ',';
}

export function StepUpload({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
        setError('Unsupported file type. Please upload a CSV or Excel file.');
        setLoading(false);
        return;
      }

      let columns: string[] = [];
      let rows: ParsedRow[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const delimiter = detectDelimiter(text);
        const wb = XLSX.read(text, { type: 'string', FS: delimiter });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        if (json.length === 0) throw new Error('File is empty or could not be parsed.');
        columns = Object.keys(json[0]);
        rows = json.map(r => {
          const row: ParsedRow = {};
          for (const k of columns) row[k] = String(r[k] ?? '');
          return row;
        });
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        if (json.length === 0) throw new Error('File is empty or could not be parsed.');
        columns = Object.keys(json[0]);
        rows = json.map(r => {
          const row: ParsedRow = {};
          for (const k of columns) row[k] = String(r[k] ?? '');
          return row;
        });
      }

      onParsed(columns, rows);
    } catch (err: any) {
      setError(err.message || 'Failed to read the file.');
    } finally {
      setLoading(false);
    }
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">Supported formats</p>
        <p className="text-sm text-blue-700">CSV files (auto-detects delimiters), Excel files (.xlsx, .xls)</p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
          ${dragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-slate-600 font-medium">Parsing file...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Upload className="w-10 h-10 text-slate-400" />
              <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700 mb-1">
              Drag and drop your file here
            </p>
            <p className="text-sm text-slate-500 mb-5">or</p>
            <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors shadow-sm">
              <Upload className="w-4 h-4" />
              Choose File
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
