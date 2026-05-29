import { useState, useEffect, useCallback } from 'react';
import { X, Database, FileText, Loader2, EyeOff, Eye } from 'lucide-react';
import { DrillableField } from './DrillableField';

interface RecordDetailModalProps {
  record: Record<string, unknown> | null;
  isOpen: boolean;
  onClose: () => void;
  onViewDocuments?: () => void;
  loading?: boolean;
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function RecordDetailModal({ record, isOpen, onClose, onViewDocuments, loading }: RecordDetailModalProps) {
  const [hideEmpty, setHideEmpty] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const allEntries = record
    ? Object.entries(record).filter(([, value]) => value !== undefined)
    : [];

  const entries = hideEmpty
    ? allEntries.filter(([, value]) => hasValue(value))
    : allEntries;

  const recordId = record?.file_id || record?.id || record?.temporary_primary_key || 'Record';
  const fileId = record?.file_id ? String(record.file_id) : '';
  const hiddenCount = allEntries.length - entries.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-4rem)] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Record Details</h2>
              {!loading && record && (
                <p className="text-sm text-gray-500 font-mono">{String(recordId)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && record && (
              <button
                onClick={() => setHideEmpty(prev => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  hideEmpty
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {hideEmpty ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {hideEmpty ? 'Show All Fields' : 'Hide Empty Fields'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Hint bar */}
        {!loading && record && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 shrink-0 flex items-center justify-between">
            <p className="text-xs text-blue-700">Click any field to view its source documents</p>
            {hideEmpty && hiddenCount > 0 && (
              <p className="text-xs text-gray-500">{hiddenCount} empty field{hiddenCount !== 1 ? 's' : ''} hidden</p>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-600 text-sm">Loading record details...</p>
            </div>
          )}

          {!loading && record && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {entries.map(([key, value]) => (
                <DrillableField
                  key={key}
                  fieldKey={key}
                  fieldLabel={formatFieldName(key)}
                  value={value}
                  fileId={fileId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {!loading && record ? `${entries.length} field${entries.length !== 1 ? 's' : ''}${hideEmpty ? ` shown` : ''}` : ''}
          </p>
          <div className="flex items-center gap-2">
            {onViewDocuments && !loading && (
              <button
                onClick={onViewDocuments}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                View All Documents
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
