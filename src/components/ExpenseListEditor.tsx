import { Trash2, PlusCircle, Wallet, Upload, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';

export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const ALLOWED_RECEIPT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

export function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

// Converts a YYYY-MM-DD (or ISO) date into MM-DD-YYYY for receipt filenames.
export function formatDateForFilename(date: string | null | undefined): string {
  if (!date) return '';
  const onlyDate = date.includes('T') ? date.split('T')[0] : date;
  const [year, month, day] = onlyDate.split('-');
  if (!year || !month || !day) return '';
  return `${month}-${day}-${year}`;
}

export interface ReceiptNameParts {
  date?: string | null;
  username?: string | null;
  contactName?: string | null;
  description?: string | null;
}

// Receipt files are named `mm-dd-yyyy_username_contactname_description${ext}`.
// Any missing field is skipped entirely rather than left as an empty segment.
export function buildReceiptFilename(parts: ReceiptNameParts, originalName: string): string {
  const ext = getFileExtension(originalName);
  const segments: string[] = [];
  const date = formatDateForFilename(parts.date);
  if (date) segments.push(date);
  if (parts.username && parts.username.trim()) segments.push(sanitizeFilenamePart(parts.username));
  if (parts.contactName && parts.contactName.trim()) segments.push(sanitizeFilenamePart(parts.contactName));
  if (parts.description && parts.description.trim()) segments.push(sanitizeFilenamePart(parts.description));
  const base = segments.join('_') || 'receipt';
  return `${base}${ext}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ExpenseDraft {
  key: string;
  description: string;
  amount: string;
  file: File | null;
  fileError?: string | null;
}

export function expensesTotal(expenses: ExpenseDraft[]): number {
  return expenses.reduce((sum, e) => {
    const n = parseFloat(e.amount);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

export function expenseIsValid(expense: ExpenseDraft): boolean {
  const n = parseFloat(expense.amount);
  return (
    expense.description.trim().length > 0 &&
    !Number.isNaN(n) &&
    n > 0 &&
    !expense.fileError
  );
}

// A receipt is optional and can be attached later; an expense only needs a
// description and an amount > 0 (and any attached file must be valid).
export function expensesValid(expenses: ExpenseDraft[]): boolean {
  return expenses.every(expenseIsValid);
}

function validateReceiptFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  const typeOk = ALLOWED_RECEIPT_TYPES.includes(file.type) || ALLOWED_RECEIPT_EXTENSIONS.includes(ext);
  if (!typeOk) return 'Unsupported file type. Use JPG, PNG, or PDF.';
  if (file.size > MAX_RECEIPT_BYTES) return 'File is too large. Maximum size is 10MB.';
  return null;
}

interface ExpenseListEditorProps {
  expenses: ExpenseDraft[];
  onChange: (next: ExpenseDraft[]) => void;
  date: string;
  contactName: string;
  username?: string;
}

export function ExpenseListEditor({ expenses, onChange, date, contactName, username }: ExpenseListEditorProps) {
  const total = expensesTotal(expenses);

  const addRow = () => {
    onChange([...expenses, { key: crypto.randomUUID(), description: '', amount: '', file: null, fileError: null }]);
  };

  const updateRow = (key: string, patch: Partial<ExpenseDraft>) => {
    onChange(expenses.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const removeRow = (key: string) => {
    onChange(expenses.filter((e) => e.key !== key));
  };

  const onFileSelected = (key: string, file: File | null) => {
    if (!file) {
      updateRow(key, { file: null, fileError: null });
      return;
    }
    const error = validateReceiptFile(file);
    updateRow(key, { file: error ? null : file, fileError: error });
  };

  const previewNameFor = (expense: ExpenseDraft): string | null => {
    if (!expense.file || !expense.description.trim()) return null;
    return buildReceiptFilename(
      { date, username, contactName, description: expense.description },
      expense.file.name,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
          <Wallet className="w-4 h-4" />
          Itemized Expenses
        </p>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {expenses.length > 0 && (
        <ul className="space-y-2">
          {expenses.map((e) => {
            const invalid = !expenseIsValid(e);
            const previewName = previewNameFor(e);
            return (
              <li
                key={e.key}
                className={`p-2.5 rounded-lg border space-y-2 ${
                  invalid ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    value={e.description}
                    onChange={(ev) => updateRow(e.key, { description: ev.target.value })}
                    placeholder="What was this for?"
                    className="flex-1 min-w-0 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={e.amount}
                        onChange={(ev) => updateRow(e.key, { amount: ev.target.value })}
                        placeholder="0.00"
                        className="w-28 pl-5 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(e.key)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {e.file ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="flex items-center gap-2 min-w-0 text-sm text-slate-700">
                      {e.file.type === 'application/pdf' ? (
                        <FileText className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      ) : (
                        <ImageIcon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      )}
                      <span className="truncate">{e.file.name}</span>
                      <span className="flex-shrink-0 text-xs text-slate-400">{formatFileSize(e.file.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onFileSelected(e.key, null)}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors w-fit">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Attach receipt</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      className="hidden"
                      onChange={(ev) => onFileSelected(e.key, ev.target.files?.[0] ?? null)}
                    />
                  </label>
                )}

                {e.fileError && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {e.fileError}
                  </p>
                )}

                {previewName && (
                  <p className="text-xs text-emerald-700">
                    Saved as: <span className="font-mono break-all">{previewName}</span>
                  </p>
                )}
                {e.file && !previewName && (
                  <p className="text-xs text-amber-600">
                    Add a description to name the receipt file.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-sm font-medium text-slate-600">Total</span>
        <span className="text-lg font-bold text-slate-900">${total.toFixed(2)}</span>
      </div>

      {expenses.length === 0 && (
        <p className="text-xs text-slate-500">Click "Add Expense" to add one or more expenses. A receipt is optional and can be attached now or later.</p>
      )}
      {expenses.length > 0 && !expensesValid(expenses) && (
        <p className="text-xs text-red-600 font-medium">
          Every expense needs a description and an amount greater than 0.
        </p>
      )}
    </div>
  );
}
