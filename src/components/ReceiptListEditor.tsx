import { useState } from 'react';
import { Trash2, Pencil, PlusCircle, Receipt, X, Upload, DollarSign } from 'lucide-react';

export interface ReceiptItem {
  key: string;
  existingId?: string;
  file: File | null;
  fileName: string;
  filePath?: string;
  amount: string;
}

export function receiptsTotal(receipts: ReceiptItem[]): number {
  return receipts.reduce((sum, r) => {
    const n = parseFloat(r.amount);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

export function receiptHasAmount(receipt: ReceiptItem): boolean {
  const n = parseFloat(receipt.amount);
  return !Number.isNaN(n) && n > 0;
}

// At least one receipt with a file and a valid amount, and no receipt missing an amount.
export function receiptsValid(receipts: ReceiptItem[]): boolean {
  if (receipts.length === 0) return false;
  if (!receipts.every(receiptHasAmount)) return false;
  return receipts.some((r) => r.file !== null || !!r.filePath);
}

interface ReceiptListEditorProps {
  receipts: ReceiptItem[];
  onChange: (next: ReceiptItem[]) => void;
}

export function ReceiptListEditor({ receipts, onChange }: ReceiptListEditorProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const total = receiptsTotal(receipts);
  const hasMissingAmount = receipts.some((r) => !receiptHasAmount(r));
  const canConfirmAdd = !!newFile && receiptHasAmount({ key: '', file: newFile, fileName: '', amount: newAmount });

  const confirmAdd = () => {
    if (!canConfirmAdd || !newFile) return;
    onChange([
      ...receipts,
      { key: crypto.randomUUID(), file: newFile, fileName: newFile.name, amount: newAmount },
    ]);
    setNewFile(null);
    setNewAmount('');
    setShowAdd(false);
  };

  const updateAmount = (key: string, amount: string) => {
    onChange(receipts.map((r) => (r.key === key ? { ...r, amount } : r)));
  };

  const replaceFile = (key: string, file: File) => {
    onChange(receipts.map((r) => (r.key === key ? { ...r, file, fileName: file.name } : r)));
    setEditingKey(null);
  };

  const removeReceipt = (key: string) => {
    onChange(receipts.filter((r) => r.key !== key));
    if (editingKey === key) setEditingKey(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
          <Receipt className="w-4 h-4" />
          Receipts
        </p>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Receipt
          </button>
        )}
      </div>

      {receipts.length > 0 && (
        <ul className="space-y-2">
          {receipts.map((r) => {
            const invalid = !receiptHasAmount(r);
            return (
              <li
                key={r.key}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg border ${
                  invalid ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className="flex-1 flex items-center gap-1 text-sm text-slate-700 truncate min-w-0">
                  <Receipt className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{r.fileName || 'Receipt'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.amount}
                      onChange={(e) => updateAmount(r.key, e.target.value)}
                      placeholder="0.00"
                      className="w-28 pl-5 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingKey(editingKey === r.key ? null : r.key)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    title="Replace file"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReceipt(r.key)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Delete receipt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {editingKey === r.key && (
                  <div className="w-full sm:w-auto">
                    <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose new file</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) replaceFile(r.key, file);
                        }}
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && (
        <div className="p-3 border border-green-300 bg-green-50 rounded-lg space-y-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              <Upload className="w-3.5 h-3.5 inline mr-1" />
              Receipt File
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmAdd}
              disabled={!canConfirmAdd}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewFile(null);
                setNewAmount('');
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-sm font-medium text-slate-600">Total</span>
        <span className="text-lg font-bold text-slate-900">${total.toFixed(2)}</span>
      </div>

      {receipts.length === 0 && (
        <p className="text-xs text-slate-500">Add at least one receipt with an amount.</p>
      )}
      {hasMissingAmount && receipts.length > 0 && (
        <p className="text-xs text-red-600 font-medium">All receipts must have an amount greater than 0 before saving.</p>
      )}
    </div>
  );
}
