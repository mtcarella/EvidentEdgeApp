import { useState } from 'react';
import { FileSearch, ShieldX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileSearchForm, SearchFilters } from './FileSearchForm';
import { FileDetailView, DocumentIntakeRecord } from './FileDetailView';

export function FileViewer() {
  const { salesPerson } = useAuth();
  const [record, setRecord] = useState<DocumentIntakeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  if (!salesPerson?.file_viewer_enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-4 bg-red-50 rounded-full mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600 text-sm">You do not have permission to access the File Viewer module.</p>
      </div>
    );
  }

  const handleSearch = async (filters: SearchFilters) => {
    setLoading(true);
    setError(null);
    setRecord(null);
    setSearched(true);

    try {
      let query = supabase.from('document_intake').select('*');

      if (filters.file_id) {
        query = query.eq('file_id', filters.file_id);
      }
      if (filters.file_name) {
        query = query.ilike('file_name', `%${filters.file_name}%`);
      }
      if (filters.status) {
        query = query.ilike('status', `%${filters.status}%`);
      }

      const { data, error: queryError } = await query.limit(1).maybeSingle();

      if (queryError) {
        setError('An error occurred while searching. Please try again.');
        return;
      }

      if (!data) {
        setError('No record found matching your search criteria.');
        return;
      }

      setRecord(data as DocumentIntakeRecord);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
          <FileSearch className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">File Viewer</h1>
          <p className="text-sm text-slate-500">Search and view document intake records</p>
        </div>
      </div>

      <FileSearchForm onSearch={handleSearch} loading={loading} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {record && <FileDetailView record={record} />}

      {searched && !loading && !error && !record && (
        <div className="text-center py-12 text-slate-400">
          <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No results to display</p>
        </div>
      )}

      {!searched && (
        <div className="text-center py-16 text-slate-400">
          <FileSearch className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">Enter search criteria above and click Search</p>
          <p className="text-xs mt-1">Results will be displayed here</p>
        </div>
      )}
    </div>
  );
}
