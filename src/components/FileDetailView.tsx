import { FileText, AlignLeft, Activity, Clock, Globe } from 'lucide-react';
import { FileDetailSection } from './FileDetailSection';

export interface DocumentIntakeRecord {
  id: string;
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  content: string;
  description: string;
  tags: string[];
  notes: string;
  status: string;
  processing_stage: string;
  error_message: string;
  source: string;
  uploaded_by: string;
  origin_system: string;
  intake_date: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FileDetailViewProps {
  record: DocumentIntakeRecord;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function FileDetailView({ record }: FileDetailViewProps) {
  const metadataFields = [
    { label: 'File ID', value: record.file_id },
    { label: 'File Name', value: record.file_name },
    { label: 'File Type', value: record.file_type },
    { label: 'File Size', value: record.file_size ? formatFileSize(record.file_size) : null },
  ];

  const contentFields = [
    { label: 'Content', value: record.content, isLongText: true },
    { label: 'Description', value: record.description, isLongText: true },
    { label: 'Tags', value: record.tags?.length ? record.tags.join(', ') : null },
    { label: 'Notes', value: record.notes, isLongText: true },
  ];

  const statusFields = [
    { label: 'Status', value: record.status },
    { label: 'Processing Stage', value: record.processing_stage },
    { label: 'Error Message', value: record.error_message, isLongText: true },
  ];

  const dateFields = [
    { label: 'Intake Date', value: formatDate(record.intake_date) },
    { label: 'Processed At', value: formatDate(record.processed_at) },
    { label: 'Created At', value: formatDate(record.created_at) },
    { label: 'Updated At', value: formatDate(record.updated_at) },
  ];

  const sourceFields = [
    { label: 'Source', value: record.source },
    { label: 'Uploaded By', value: record.uploaded_by },
    { label: 'Origin System', value: record.origin_system },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FileText className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{record.file_name || record.file_id}</h2>
          <p className="text-xs text-slate-500">Record ID: {record.id}</p>
        </div>
        <div className="ml-auto">
          <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
            record.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
            record.status === 'error' ? 'bg-red-100 text-red-800' :
            record.status === 'processing' ? 'bg-amber-100 text-amber-800' :
            'bg-slate-100 text-slate-700'
          }`}>
            {record.status || 'Unknown'}
          </span>
        </div>
      </div>

      <FileDetailSection
        title="File Metadata"
        icon={<FileText className="w-4 h-4 text-blue-600" />}
        fields={metadataFields}
        color="from-blue-50 to-slate-50"
      />

      <FileDetailSection
        title="Content Details"
        icon={<AlignLeft className="w-4 h-4 text-emerald-600" />}
        fields={contentFields}
        color="from-emerald-50 to-slate-50"
      />

      <FileDetailSection
        title="Status & Processing"
        icon={<Activity className="w-4 h-4 text-amber-600" />}
        fields={statusFields}
        color="from-amber-50 to-slate-50"
      />

      <FileDetailSection
        title="Dates & Timestamps"
        icon={<Clock className="w-4 h-4 text-teal-600" />}
        fields={dateFields}
        color="from-teal-50 to-slate-50"
      />

      <FileDetailSection
        title="Source & Origin"
        icon={<Globe className="w-4 h-4 text-slate-600" />}
        fields={sourceFields}
        color="from-slate-100 to-slate-50"
      />
    </div>
  );
}
