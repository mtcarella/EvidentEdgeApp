import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface TransactionSummaryRow {
  file_id: string;
  document_count: number;
  latest_received_at: string | null;
  latest_document_name: string | null;
  latest_document_type: string | null;
  latest_document_date: string | null;
  latest_intake_email_from: string | null;
  latest_intake_email_subject: string | null;
  latest_intake_filename: string | null;
  file_status: string | null;
  transaction_type: string | null;
  property_address_line_1: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_county: string | null;
  buyer_1_full_name: string | null;
  seller_1_full_name: string | null;
  closing_date: string | null;
  purchase_price: string | null;
  loan_amount: string | null;
  lender_name: string | null;
  buyer_attorney_full_name: string | null;
  seller_attorney_full_name: string | null;
  [key: string]: unknown;
}

const SUMMARY_COLUMNS = [
  'file_id',
  'document_count',
  'latest_received_at',
  'latest_document_name',
  'latest_document_type',
  'latest_document_date',
  'latest_intake_email_from',
  'latest_intake_email_subject',
  'latest_intake_filename',
  'file_status',
  'transaction_type',
  'property_address_line_1',
  'property_city',
  'property_state',
  'property_zip',
  'property_county',
  'buyer_1_full_name',
  'seller_1_full_name',
  'closing_date',
  'purchase_price',
  'loan_amount',
  'lender_name',
  'buyer_attorney_full_name',
  'seller_attorney_full_name',
].join(',');

export function useTransactionSummary() {
  const [data, setData] = useState<TransactionSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const { data: rows, error: queryError } = await supabase
      .from('transaction_summary_view')
      .select(SUMMARY_COLUMNS);

    if (queryError) {
      setError(queryError.message);
      setData([]);
    } else {
      setData((rows || []) as TransactionSummaryRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}
