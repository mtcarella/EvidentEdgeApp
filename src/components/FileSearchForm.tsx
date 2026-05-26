import { useState } from 'react';
import { Search, Loader2, RotateCcw } from 'lucide-react';

interface FileSearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  loading: boolean;
}

export interface SearchFilters {
  file_id: string;
  file_name: string;
  status: string;
}

export function FileSearchForm({ onSearch, loading }: FileSearchFormProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    file_id: '',
    file_name: '',
    status: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({ file_id: '', file_name: '', status: '' });
  };

  const hasInput = filters.file_id || filters.file_name || filters.status;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center gap-2.5">
          <Search className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-slate-800">Search Document Intake</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-7.5">
          Enter at least one field to search. File ID is the primary identifier.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              File ID <span className="text-slate-400 text-xs font-normal">(primary)</span>
            </label>
            <input
              type="text"
              value={filters.file_id}
              onChange={(e) => setFilters({ ...filters, file_id: e.target.value })}
              placeholder="Enter file ID..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              File Name
            </label>
            <input
              type="text"
              value={filters.file_name}
              onChange={(e) => setFilters({ ...filters, file_name: e.target.value })}
              placeholder="Search by name..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Status
            </label>
            <input
              type="text"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              placeholder="e.g. pending, completed..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !hasInput}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>

          {hasInput && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-medium rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
