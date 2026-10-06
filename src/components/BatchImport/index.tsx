import { useState, useCallback, useMemo } from 'react';
import { FileUp, Columns, Users, Table2, CheckCircle, Check, GitCompare } from 'lucide-react';
import { StepUpload } from './StepUpload';
import { StepMapping } from './StepMapping';
import { StepDefaults } from './StepDefaults';
import { StepPreview, computeWarnings } from './StepPreview';
import { StepDuplicates } from './StepDuplicates';
import { StepConfirm } from './StepConfirm';
import { supabase } from '../../lib/supabase';
import type { ParsedRow, ImportRow, DuplicateMatch, ExistingContact } from './types';
import { normalizeType } from './types';

const STEPS = [
  { label: 'Upload', icon: FileUp },
  { label: 'Map Fields', icon: Columns },
  { label: 'Defaults', icon: Users },
  { label: 'Preview', icon: Table2 },
  { label: 'Duplicates', icon: GitCompare },
  { label: 'Import', icon: CheckCircle },
];

export function BatchImportWizard() {
  const [step, setStep] = useState(0);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultSalesperson, setDefaultSalesperson] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);

  const handleParsed = useCallback((columns: string[], rows: ParsedRow[]) => {
    setSourceColumns(columns);
    setRawRows(rows);
    setMapping({});
    setStep(1);
  }, []);

  const buildImportRows = useCallback(() => {
    const mapped: ImportRow[] = rawRows.map((raw, idx) => {
      const row: ImportRow = { _selected: true, _rowIndex: idx, _warnings: [] };

      for (const [srcCol, targetField] of Object.entries(mapping)) {
        if (targetField && targetField !== '_skip') {
          row[targetField] = raw[srcCol] || '';
        }
      }

      row._salesperson = defaultSalesperson;
      row._branch = defaultBranch;

      if (row.type) row.type = normalizeType(row.type);

      row._warnings = computeWarnings(row);
      return row;
    });

    setImportRows(mapped);
  }, [rawRows, mapping, defaultSalesperson, defaultBranch]);

  const visibleColumns = useMemo(() => {
    const mapped = Object.values(mapping).filter(v => v && v !== '_skip');
    return [...new Set([...mapped, '_salesperson', '_branch'])];
  }, [mapping]);

  const goToPreview = useCallback(() => {
    buildImportRows();
    setStep(3);
  }, [buildImportRows]);

  const runDuplicateCheck = useCallback(async () => {
    setCheckingDupes(true);

    const selected = importRows.filter(r => r._selected);
    const rowsWithEmail = selected.filter(r => r.name && r.email);

    if (rowsWithEmail.length === 0) {
      setDuplicates([]);
      setCheckingDupes(false);
      setStep(5);
      return;
    }

    try {
      const names = rowsWithEmail.map(r => String(r.name).trim().toLowerCase());
      const emails = rowsWithEmail.map(r => String(r.email).trim().toLowerCase());

      const uniqueNames = [...new Set(names)];
      const uniqueEmails = [...new Set(emails)];

      const batchSize = 50;
      const allExisting: ExistingContact[] = [];

      for (let i = 0; i < uniqueNames.length; i += batchSize) {
        const namesBatch = uniqueNames.slice(i, i + batchSize);

        const { data } = await supabase
          .from('contacts')
          .select('id, name, type, email, phone, cell_phone, company, branch, address, notes, birthday, client_type, grade, drinks, preferred_surveyor, preferred_uw, preferred_closer, client_identifier_no, processor_notes, assigned_to')
          .or(namesBatch.map(n => `name.ilike.${n}`).join(','));

        if (data) allExisting.push(...(data as ExistingContact[]));
      }

      for (let i = 0; i < uniqueEmails.length; i += batchSize) {
        const emailBatch = uniqueEmails.slice(i, i + batchSize);

        const { data } = await supabase
          .from('contacts')
          .select('id, name, type, email, phone, cell_phone, company, branch, address, notes, birthday, client_type, grade, drinks, preferred_surveyor, preferred_uw, preferred_closer, client_identifier_no, processor_notes, assigned_to')
          .or(emailBatch.map(e => `email.ilike.${e}`).join(','));

        if (data) {
          for (const c of data as ExistingContact[]) {
            if (!allExisting.some(ex => ex.id === c.id)) allExisting.push(c);
          }
        }
      }

      const matches: DuplicateMatch[] = [];
      const matchedRowIndices = new Set<number>();

      for (const row of rowsWithEmail) {
        const rowName = String(row.name).trim().toLowerCase();
        const rowEmail = String(row.email).trim().toLowerCase();

        const match = allExisting.find(ex =>
          ex.name?.toLowerCase().trim() === rowName &&
          ex.email?.toLowerCase().trim() === rowEmail
        );

        if (match) {
          matchedRowIndices.add(row._rowIndex);
          matches.push({
            importRow: row,
            existing: match,
            action: 'replace',
            fieldsToReplace: new Set<string>(),
          });
        }
      }

      setDuplicates(matches);
      setCheckingDupes(false);

      if (matches.length > 0) {
        setStep(4);
      } else {
        setStep(5);
      }
    } catch {
      setDuplicates([]);
      setCheckingDupes(false);
      setStep(5);
    }
  }, [importRows]);

  const nonDuplicateRows = useMemo(() => {
    const dupeIndices = new Set(duplicates.map(d => d.importRow._rowIndex));
    return importRows.filter(r => r._selected && !dupeIndices.has(r._rowIndex));
  }, [importRows, duplicates]);

  const reset = useCallback(() => {
    setStep(0);
    setSourceColumns([]);
    setRawRows([]);
    setMapping({});
    setDefaultSalesperson('');
    setDefaultBranch('');
    setImportRows([]);
    setDuplicates([]);
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;

            return (
              <div key={i} className="flex items-center">
                {i > 0 && (
                  <div className={`w-6 sm:w-12 h-0.5 mx-0.5 sm:mx-1.5 transition-colors ${done ? 'bg-blue-500' : 'bg-slate-200'}`} />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                    ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-slate-200 text-slate-400'}`}
                  >
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${active ? 'text-blue-700' : done ? 'text-blue-600' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="p-6">
        {step === 0 && (
          <StepUpload onParsed={handleParsed} />
        )}
        {step === 1 && (
          <StepMapping
            columns={sourceColumns}
            rows={rawRows}
            mapping={mapping}
            onMappingChange={setMapping}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepDefaults
            defaultSalesperson={defaultSalesperson}
            defaultBranch={defaultBranch}
            onDefaultsChange={(sp, b) => { setDefaultSalesperson(sp); setDefaultBranch(b); }}
            onNext={goToPreview}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepPreview
            rows={importRows}
            visibleColumns={visibleColumns}
            defaultSalesperson={defaultSalesperson}
            defaultBranch={defaultBranch}
            onRowsChange={setImportRows}
            onNext={runDuplicateCheck}
            onBack={() => setStep(2)}
          />
        )}

        {/* Duplicate check loading */}
        {checkingDupes && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">Checking for duplicate contacts...</p>
            <p className="text-xs text-slate-400">Scanning {importRows.filter(r => r._selected).length} contacts against your database</p>
          </div>
        )}

        {step === 4 && !checkingDupes && (
          <StepDuplicates
            duplicates={duplicates}
            nonDuplicateCount={nonDuplicateRows.length}
            onDuplicatesChange={setDuplicates}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && !checkingDupes && (
          <StepConfirm
            rows={importRows}
            duplicates={duplicates}
            defaultSalesperson={defaultSalesperson}
            defaultBranch={defaultBranch}
            onBack={() => duplicates.length > 0 ? setStep(4) : setStep(3)}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}
