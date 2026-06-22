import { useState, useEffect, useCallback } from 'react';
import { X, FileText, Eye, Loader2, FileSpreadsheet, FileArchive } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DocumentPreview } from './DocumentPreview';

interface SourceDocument {
  temporary_primary_key: string;
  document_name: string | null;
  document_type: string | null;
  document_date: string | null;
  intake_filename: string | null;
  document_summary: string | null;
}

interface SourceDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
  fieldLabel: string;
  fileId: string;
}

export function SourceDocumentsModal({ isOpen, onClose, fieldName, fieldLabel, fileId }: SourceDocumentsModalProps) {
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SourceDocument | null>(null);
  const [docUrl, setDocUrl] = useState<string>('');
  const [docStoragePath, setDocStoragePath] = useState<string>('');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (previewDoc) {
        setPreviewDoc(null);
      } else {
        onClose();
      }
    }
  }, [onClose, previewDoc]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen || !fileId || !fieldName) return;

    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      setDocuments([]);

      const { data, error: queryError } = await supabase
        .from('document_Intake')
        .select('temporary_primary_key, document_name, document_type, document_date, intake_filename, document_summary')
        .eq('file_id', fileId)
        .not(fieldName, 'is', null)
        .neq(fieldName, '');

      if (queryError) {
        setError(queryError.message);
      } else {
        setDocuments((data || []) as SourceDocument[]);
      }
      setLoading(false);
    };

    fetchDocuments();
  }, [isOpen, fileId, fieldName]);

  const findStorageFile = async (docFileId: string, docType: string): Promise<string | null> => {
    const normalizedType = docType.replace(/\s+/g, '_').toUpperCase();

    const { data: files } = await supabase.storage
      .from('documents')
      .list('', { search: docFileId, limit: 100 });

    if (!files || files.length === 0) return null;

    const underscorePattern = `${docFileId}_${normalizedType}`;
    const spacePattern = `${docFileId} ${normalizedType}`;

    const match = files.find(f =>
      f.name.startsWith(underscorePattern) || f.name.startsWith(spacePattern)
    );

    return match?.name || null;
  };

  const openPreview = async (doc: SourceDocument) => {
    let signedUrl = '';
    let resolvedPath = '';

    if (fileId && doc.document_type) {
      const storageName = await findStorageFile(fileId, doc.document_type);
      if (storageName) {
        resolvedPath = storageName;
        const { data, error: signError } = await supabase.storage
          .from('documents')
          .createSignedUrl(storageName, 3600);
        if (signError) {
          console.error('[SourceDocuments] Signed URL error for', storageName, signError);
        } else if (data?.signedUrl) {
          signedUrl = data.signedUrl;
        }
      }
    }

    if (!signedUrl && doc.intake_filename) {
      resolvedPath = doc.intake_filename;
      const { data, error: signError } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.intake_filename, 3600);
      if (signError) {
        console.error('[SourceDocuments] Signed URL error for', doc.intake_filename, signError);
      } else if (data?.signedUrl) {
        signedUrl = data.signedUrl;
      }
    }

    if (!signedUrl) {
      console.error('[SourceDocuments] Could not generate a signed URL for document:', doc.document_name, '| fileId:', fileId, '| type:', doc.document_type);
    }

    setDocUrl(signedUrl);
    setDocStoragePath(resolvedPath);
    setPreviewDoc(doc);
  };

  if (!isOpen) return null;

  const getDocIcon = (filename: string | null) => {
    if (!filename) return <FileText className="w-5 h-5 text-blue-500" />;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    if (ext === 'zip') return <FileArchive className="w-5 h-5 text-amber-600" />;
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-12 pb-8 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={previewDoc ? () => setPreviewDoc(null) : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-5rem)] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 mb-0.5">Source Documents for</p>
            <h2 className="text-lg font-bold text-gray-900 truncate">{fieldLabel}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors shrink-0 ml-3"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-600 text-sm">Loading source documents...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FileText className="w-10 h-10 mb-3 text-gray-300" />
              <p className="font-medium">No source documents found</p>
              <p className="text-sm mt-1 text-center">No documents contributed data to this field.</p>
            </div>
          )}

          {!loading && !error && documents.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-semibold text-gray-900">{documents.length}</span> document{documents.length !== 1 ? 's' : ''} contributed to this field
              </p>

              {documents.map((doc) => (
                <div
                  key={doc.temporary_primary_key}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getDocIcon(doc.intake_filename)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {doc.document_name || doc.intake_filename || 'Untitled Document'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {doc.document_type && <span className="bg-gray-100 px-2 py-0.5 rounded">{doc.document_type}</span>}
                        {doc.document_date && <span>{doc.document_date}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => openPreview(doc)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full Document Preview Modal */}
          {previewDoc && (
            <DocumentPreview
              isOpen={!!previewDoc}
              onClose={() => { setPreviewDoc(null); setDocUrl(''); setDocStoragePath(''); }}
              fileUrl={docUrl}
              fileName={previewDoc.intake_filename || previewDoc.document_name || 'document'}
              storagePath={docStoragePath}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
