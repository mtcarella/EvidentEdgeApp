import { DocumentIntakeRow } from '../../hooks/useDocumentIntake';

interface DocumentIntakeTableProps {
  data: DocumentIntakeRow[];
}

const DISPLAY_COLUMNS: { key: keyof DocumentIntakeRow; label: string }[] = [
  { key: 'document_type', label: 'Document Type' },
  { key: 'document_name', label: 'Document Name' },
  { key: 'document_date', label: 'Date' },
  { key: 'intake_email_from', label: 'From' },
  { key: 'intake_email_subject', label: 'Subject' },
  { key: 'intake_received_timestamp', label: 'Received' },
  { key: 'intake_filename', label: 'Filename' },
  { key: 'file_status', label: 'Status' },
];

export function DocumentIntakeTable({ data }: DocumentIntakeTableProps) {
  return (
    <div className="overflow-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {DISPLAY_COLUMNS.map(col => (
              <th key={col.key} className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, idx) => (
            <tr key={row.temporary_primary_key || idx} className="hover:bg-gray-50 transition-colors">
              {DISPLAY_COLUMNS.map(col => (
                <td key={col.key} className="px-3 py-2.5 text-gray-700 max-w-[220px] truncate whitespace-nowrap">
                  {row[col.key] != null ? String(row[col.key]) : '\u2014'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
