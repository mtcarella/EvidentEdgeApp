import { X, FileText, Loader2 } from 'lucide-react';
import { DocumentIntakeRow } from '../../hooks/useDocumentIntake';
import { DocumentIntakeTable } from './DocumentIntakeTable';

interface DetailPanelProps {
  fileId: string;
  data: DocumentIntakeRow[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function DetailPanel({ fileId, data, loading, error, onClose }: DetailPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Document Intake Records</h2>
              <p className="text-sm text-gray-500">File ID: <span className="font-mono font-medium text-gray-700">{fileId}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-600 text-sm">Loading related documents...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FileText className="w-10 h-10 mb-3 text-gray-300" />
              <p className="font-medium">No related records found</p>
              <p className="text-sm mt-1">No document intake records exist for this file ID.</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-semibold text-gray-900">{data.length}</span> document{data.length !== 1 ? 's' : ''} found
              </p>
              <DocumentIntakeTable data={data} />

              {/* Detail cards for document summaries */}
              {data.some(d => d.document_summary) && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Document Summaries</h3>
                  {data.filter(d => d.document_summary).map((doc, idx) => (
                    <div key={doc.temporary_primary_key || idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-blue-600 mb-1">{doc.document_type || doc.document_name || 'Document'}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{doc.document_summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
