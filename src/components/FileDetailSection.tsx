import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FieldEntry {
  label: string;
  value: string | number | null | undefined;
  isLongText?: boolean;
}

interface FileDetailSectionProps {
  title: string;
  icon: React.ReactNode;
  fields: FieldEntry[];
  color: string;
}

export function FileDetailSection({ title, icon, fields, color }: FileDetailSectionProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleExpand = (label: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const formatValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '\u2014';
    return String(value);
  };

  const visibleFields = fields.filter(f => formatValue(f.value) !== '\u2014' || true);

  if (visibleFields.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r ${color}`}>
        <div className="flex items-center gap-2.5">
          {icon}
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {visibleFields.map((field) => {
          const displayValue = formatValue(field.value);
          const isExpanded = expandedFields.has(field.label);
          const shouldTruncate = field.isLongText && displayValue.length > 200;

          return (
            <div key={field.label} className="px-5 py-3 hover:bg-slate-25 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide sm:w-44 sm:flex-shrink-0 sm:pt-0.5">
                  {field.label}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm text-slate-800 break-words ${displayValue === '\u2014' ? 'text-slate-400 italic' : ''}`}>
                    {shouldTruncate && !isExpanded
                      ? displayValue.slice(0, 200) + '...'
                      : displayValue}
                  </span>
                  {shouldTruncate && (
                    <button
                      onClick={() => toggleExpand(field.label)}
                      className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {isExpanded ? (
                        <>Show less <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>Show more <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
