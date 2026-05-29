import { useState } from 'react';
import { Loader2, AlertCircle, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTransactionSummary, TransactionSummaryRow } from '../../hooks/useTransactionSummary';
import { useDocumentIntake } from '../../hooks/useDocumentIntake';
import { TransactionGrid } from './TransactionGrid';
import { DetailPanel } from './DetailPanel';
import { RecordDetailModal } from './RecordDetailModal';

export function FileViewerModule() {
  const { data, loading, error, refetch } = useTransactionSummary();
  const { data: intakeData, loading: intakeLoading, error: intakeError, fetchByFileId, clear } = useDocumentIntake();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState<Record<string, unknown> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const handleRowClick = async (row: TransactionSummaryRow) => {
    setSelectedFileId(row.file_id);
    setModalLoading(true);
    setModalOpen(true);

    const { data: fullRecord } = await supabase
      .from('transaction_summary_view')
      .select('*')
      .eq('file_id', row.file_id)
      .maybeSingle();

    if (fullRecord) {
      setModalRecord(fullRecord as Record<string, unknown>);
    } else {
      setModalRecord(row as unknown as Record<string, unknown>);
    }
    setModalLoading(false);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalRecord(null);
    setSelectedFileId(null);
  };

  const handleViewDocuments = () => {
    if (selectedFileId) {
      setModalOpen(false);
      setDetailPanelOpen(true);
      fetchByFileId(selectedFileId);
    }
  };

  const handleClosePanel = () => {
    setDetailPanelOpen(false);
    setSelectedFileId(null);
    clear();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-gray-600 text-sm">Loading transaction data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-3 bg-red-50 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Failed to Load Data</h2>
        <p className="text-gray-600 text-sm mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transaction Summary</h1>
          <p className="text-sm text-gray-500">Click any row to view full record details</p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0">
        <TransactionGrid
          data={data}
          selectedFileId={selectedFileId}
          onRowClick={handleRowClick}
        />
      </div>

      {/* Record Detail Modal */}
      <RecordDetailModal
        key={selectedFileId || 'closed'}
        record={modalLoading ? null : modalRecord}
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onViewDocuments={selectedFileId ? handleViewDocuments : undefined}
        loading={modalLoading}
      />

      {/* Document Intake Detail Panel */}
      {detailPanelOpen && selectedFileId && (
        <DetailPanel
          fileId={selectedFileId}
          data={intakeData}
          loading={intakeLoading}
          error={intakeError}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
