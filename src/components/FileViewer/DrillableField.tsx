import { useState } from 'react';
import { Search } from 'lucide-react';
import { SourceDocumentsModal } from './SourceDocumentsModal';

interface DrillableFieldProps {
  fieldKey: string;
  fieldLabel: string;
  value: unknown;
  fileId: string;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '\u2014';
  return String(value);
}

export function DrillableField({ fieldKey, fieldLabel, value, fileId }: DrillableFieldProps) {
  const [showSource, setShowSource] = useState(false);
  const displayValue = formatFieldValue(value);
  const isEmpty = displayValue === '\u2014';

  return (
    <>
      <div
        onClick={() => setShowSource(true)}
        className={`border rounded-lg px-4 py-3 cursor-pointer group transition-all hover:border-blue-300 hover:shadow-sm hover:bg-blue-50/40 ${
          isEmpty ? 'border-gray-100 bg-gray-50/50' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-gray-500 mb-1 truncate group-hover:text-blue-600 transition-colors" title={fieldLabel}>
            {fieldLabel}
          </p>
          <Search className="w-3 h-3 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0 mt-0.5" />
        </div>
        <p
          className={`text-sm break-words group-hover:text-blue-900 transition-colors ${
            isEmpty ? 'text-gray-400 italic' : 'text-gray-900 font-medium'
          }`}
          title={displayValue}
        >
          {displayValue}
        </p>
      </div>

      <SourceDocumentsModal
        isOpen={showSource}
        onClose={() => setShowSource(false)}
        fieldName={fieldKey}
        fieldLabel={fieldLabel}
        fileId={fileId}
      />
    </>
  );
}
