import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface DocumentIntakeRow {
  temporary_primary_key: string;
  file_id: string | null;
  file_status: string | null;
  transaction_type: string | null;
  document_type: string | null;
  document_date: string | null;
  document_name: string | null;
  property_address_line_1: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  buyer_1_full_name: string | null;
  seller_1_full_name: string | null;
  intake_email_from: string | null;
  intake_email_subject: string | null;
  intake_received_timestamp: string | null;
  intake_filename: string | null;
  document_summary: string | null;
  closing_date: string | null;
  purchase_price: string | null;
  [key: string]: unknown;
}

const INTAKE_COLUMNS = [
  'temporary_primary_key',
  'file_id',
  'file_status',
  'transaction_type',
  'document_type',
  'document_date',
  'document_name',
  'property_address_line_1',
  'property_city',
  'property_state',
  'property_zip',
  'buyer_1_full_name',
  'seller_1_full_name',
  'intake_email_from',
  'intake_email_subject',
  'intake_received_timestamp',
  'intake_filename',
  'document_summary',
  'closing_date',
  'purchase_price',
].join(',');

export function useDocumentIntake() {
  const [data, setData] = useState<DocumentIntakeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchByFileId = async (fileId: string) => {
    setLoading(true);
    setError(null);
    setData([]);

    const { data: rows, error: queryError } = await supabase
      .from('document_Intake')
      .select(INTAKE_COLUMNS)
      .eq('file_id', fileId);

    if (queryError) {
      setError(queryError.message);
    } else {
      setData((rows || []) as DocumentIntakeRow[]);
    }
    setLoading(false);
  };

  const clear = () => {
    setData([]);
    setError(null);
    setLoading(false);
  };

  return { data, loading, error, fetchByFileId, clear };
}
