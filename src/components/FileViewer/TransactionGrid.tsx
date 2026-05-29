import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransactionSummaryRow } from '../../hooks/useTransactionSummary';

interface TransactionGridProps {
  data: TransactionSummaryRow[];
  selectedFileId: string | null;
  onRowClick: (row: TransactionSummaryRow) => void;
}

const DISPLAY_COLUMNS: { key: keyof TransactionSummaryRow; label: string }[] = [
  { key: 'file_id', label: 'File ID' },
  { key: 'file_status', label: 'Status' },
  { key: 'transaction_type', label: 'Type' },
  { key: 'property_address_line_1', label: 'Address' },
  { key: 'property_city', label: 'City' },
  { key: 'property_state', label: 'State' },
  { key: 'buyer_1_full_name', label: 'Buyer' },
  { key: 'seller_1_full_name', label: 'Seller' },
  { key: 'closing_date', label: 'Closing Date' },
  { key: 'purchase_price', label: 'Price' },
  { key: 'document_count', label: 'Docs' },
  { key: 'lender_name', label: 'Lender' },
];

const PAGE_SIZE = 25;

type SortDir = 'asc' | 'desc' | null;

export function TransactionGrid({ data, selectedFileId, onRowClick }: TransactionGridProps) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const filteredData = useMemo(() => {
    let result = data;

    if (globalSearch.trim()) {
      const term = globalSearch.toLowerCase();
      result = result.filter(row =>
        DISPLAY_COLUMNS.some(col => {
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(term);
        })
      );
    }

    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (filter.trim()) {
        const term = filter.toLowerCase();
        result = result.filter(row => {
          const val = row[key as keyof TransactionSummaryRow];
          return val != null && String(val).toLowerCase().includes(term);
        });
      }
    });

    return result;
  }, [data, globalSearch, columnFilters]);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey as keyof TransactionSummaryRow];
      const bVal = b[sortKey as keyof TransactionSummaryRow];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pageData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const setColFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Global Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => { setGlobalSearch(e.target.value); setPage(0); }}
          placeholder="Search all columns..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              {DISPLAY_COLUMNS.map(col => (
                <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                  <button
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              {DISPLAY_COLUMNS.map(col => (
                <th key={`filter-${col.key}`} className="px-3 py-1.5">
                  <input
                    type="text"
                    value={columnFilters[col.key] || ''}
                    onChange={(e) => setColFilter(col.key, e.target.value)}
                    placeholder="Filter..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent font-normal"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={DISPLAY_COLUMNS.length} className="px-4 py-12 text-center text-gray-500">
                  No records match your search criteria.
                </td>
              </tr>
            ) : (
              pageData.map((row) => (
                <tr
                  key={row.file_id}
                  onClick={() => onRowClick(row)}
                  className={`cursor-pointer transition-colors ${
                    selectedFileId === row.file_id
                      ? 'bg-blue-50 ring-1 ring-inset ring-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {DISPLAY_COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-2.5 whitespace-nowrap text-gray-700 max-w-[200px] truncate">
                      {row[col.key] != null ? String(row[col.key]) : '\u2014'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-sm text-gray-600">
          {sortedData.length} record{sortedData.length !== 1 ? 's' : ''}
          {sortedData.length !== data.length && ` (filtered from ${data.length})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-700">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
