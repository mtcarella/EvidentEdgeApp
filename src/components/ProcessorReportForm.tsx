import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Save, AlertCircle, CheckCircle, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getTodayDateString } from '../lib/dateUtils';

type ReportType = 'paralegal_post_closing' | 'recording' | 'title' | 'daily' | 'marlise';

interface BaseReportFormData {
  report_date: string;
  report_type: ReportType;
}

interface ParalegalPostClosingReportData extends BaseReportFormData {
  report_type: 'paralegal_post_closing';
  purchased_closed: number | '';
  refinances_closed: number | '';
  file_count_refi: number | '';
  file_count_purchases: number | '';
  total_file_count: number | '';
  review_complete_closing_date: string;
  unresolved_issues: string;
  issues_resolved: string;
  policies_sent: number | '';
  save_closed_completed: number | '';
  searches_past_due: string;
  reissued_mail_returned: number | '';
  escrow_released: number | '';
  number_of_post_closings: number | '';
  unresolved_issues_post: string;
  pending_policies: string;
}

interface RecordingReportData extends BaseReportFormData {
  report_type: 'recording';
  deeds_recorded: number | '';
  mtg_recorded: number | '';
  nos_recorded: number | '';
  oldest_file_recorded: string;
  post_closing_recordings_date: string;
  nos_recordings_date: string;
  policies_completed: number | '';
  done_printed_mailed: number | '';
  policies_sent_kathy: number | '';
  outstanding_issues_recording: string;
}

interface TitleReportData extends BaseReportFormData {
  report_type: 'title';
  purchases_read: number;
  refinances_read: number;
  endorsements: number;
  title_reports: number;
  policies: number;
  construction_rds: number;
  sale_doc_preps: number;
  unresolved_issues_title: string;
  resolved_issues_title: string;
}

interface DailyReportData extends BaseReportFormData {
  report_type: 'daily';
  what_did_you_do: string;
  what_do_you_need_help_with: string;
  current_date_detail_file_check: string;
}

interface MarliseReportData extends BaseReportFormData {
  report_type: 'marlise';
  new_orders_entered: number | '';
  number_of_files_stacked: number | '';
  nos_sent: number | '';
  unresolved_issues: string;
  resolved_issues: string;
}

type ReportFormData = ParalegalPostClosingReportData | RecordingReportData | TitleReportData | DailyReportData | MarliseReportData;

const getInitialFormData = (reportType: ReportType): ReportFormData => {
  const baseData = {
    report_date: getTodayDateString(),
    report_type: reportType,
  };

  switch (reportType) {
    case 'paralegal_post_closing':
      return {
        ...baseData,
        report_type: 'paralegal_post_closing',
        purchased_closed: '',
        refinances_closed: '',
        file_count_refi: '',
        file_count_purchases: '',
        total_file_count: '',
        review_complete_closing_date: '',
        unresolved_issues: '',
        issues_resolved: '',
        policies_sent: '',
        save_closed_completed: '',
        searches_past_due: '',
        reissued_mail_returned: '',
        escrow_released: '',
        number_of_post_closings: '',
        unresolved_issues_post: '',
        pending_policies: '',
      };
    case 'recording':
      return {
        ...baseData,
        report_type: 'recording',
        deeds_recorded: '',
        mtg_recorded: '',
        nos_recorded: '',
        oldest_file_recorded: '',
        post_closing_recordings_date: '',
        nos_recordings_date: '',
        policies_completed: '',
        done_printed_mailed: '',
        policies_sent_kathy: '',
        outstanding_issues_recording: '',
      };
    case 'title':
      return {
        ...baseData,
        report_type: 'title',
        purchases_read: 0,
        refinances_read: 0,
        endorsements: 0,
        title_reports: 0,
        policies: 0,
        construction_rds: 0,
        sale_doc_preps: 0,
        unresolved_issues_title: '',
        resolved_issues_title: '',
      };
    case 'daily':
      return {
        ...baseData,
        report_type: 'daily',
        what_did_you_do: '',
        what_do_you_need_help_with: '',
        current_date_detail_file_check: '',
      };
    case 'marlise':
      return {
        ...baseData,
        report_type: 'marlise',
        new_orders_entered: '',
        number_of_files_stacked: '',
        nos_sent: '',
        unresolved_issues: '',
        resolved_issues: '',
      };
  }
};

interface ProcessorOption {
  id: string;
  name: string;
}

export default function ProcessorReportForm() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [processorName, setProcessorName] = useState('');
  const [selectedProcessorId, setSelectedProcessorId] = useState('');
  const [processors, setProcessors] = useState<ProcessorOption[]>([]);
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [formData, setFormData] = useState<ReportFormData>(getInitialFormData('daily'));

  useEffect(() => {
    fetchProcessorInfo();
  }, [user, isAdmin, isSuperAdmin]);

  const fetchProcessorInfo = async () => {
    if (!user) return;

    if (isAdmin || isSuperAdmin) {
      // Fetch all users who have reporting requirements enabled
      const { data, error } = await supabase
        .from('sales_people')
        .select('id, name')
        .or('requires_daily_reports.eq.true,requires_weekly_reports.eq.true')
        .order('name');

      if (error) {
        console.error('Error fetching processors:', error);
        return;
      }

      if (data) {
        setProcessors(data);
      }
    } else {
      // Fetch current user's info for non-admins (processors, sales_processors, closers)
      const { data, error } = await supabase
        .from('sales_people')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching processor info:', error);
        return;
      }

      if (data) {
        setProcessorName(data.name);
        setSelectedProcessorId(data.id);
      }
    }
  };

  const handleReportTypeChange = (newType: ReportType) => {
    setReportType(newType);
    setFormData(getInitialFormData(newType));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseInt(value)) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      let processorId: string;
      let processorNameToSubmit: string;

      if (isAdmin || isSuperAdmin) {
        // For admins, use the selected processor
        if (!selectedProcessorId) {
          throw new Error('Please select a processor');
        }
        const selectedProcessor = processors.find(p => p.id === selectedProcessorId);
        if (!selectedProcessor) {
          throw new Error('Selected processor not found');
        }
        processorId = selectedProcessorId;
        processorNameToSubmit = selectedProcessor.name;
      } else {
        // For non-admins, use their own info
        const { data: salesPerson, error: salesPersonError } = await supabase
          .from('sales_people')
          .select('id, name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (salesPersonError) throw salesPersonError;
        if (!salesPerson) throw new Error('Sales person record not found');

        processorId = salesPerson.id;
        processorNameToSubmit = salesPerson.name;
      }

      // Convert empty strings to null for numeric fields
      const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
        acc[key] = value === '' ? null : value;
        return acc;
      }, {} as any);

      const { error: insertError } = await supabase
        .from('weekly_performance_reports')
        .insert({
          processor_id: processorId,
          processor_name: processorNameToSubmit,
          ...cleanedData
        });

      if (insertError) throw insertError;

      setShowSuccessModal(true);
      setFormData(getInitialFormData(reportType));
      if (isAdmin || isSuperAdmin) {
        setSelectedProcessorId('');
      }
    } catch (error: any) {
      console.error('Error submitting report:', error);
      setErrorMessage(error.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
  };

  const handleGoToADP = () => {
    window.open('https://online.adp.com/signin/v1/?APPID=RDBX&productId=80e309c3-70c6-bae1-e053-3505430b5495&returnURL=https://my.adp.com/&callingAppId=RDBX', '_blank');
    setShowSuccessModal(false);
  };

  return (
    <>
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 rounded-full p-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Success!</h3>
                  <p className="text-gray-600 mt-1">Your report has been submitted successfully.</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoToADP}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <ExternalLink className="w-5 h-5" />
                Go to ADP
              </button>
              <button
                onClick={handleCloseModal}
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Performance Report</h2>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg flex items-center gap-2 bg-red-50 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{errorMessage}</span>
            </div>
          )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processor Name
              </label>
              {(isAdmin || isSuperAdmin) ? (
                <select
                  value={selectedProcessorId}
                  onChange={(e) => setSelectedProcessorId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a processor...</option>
                  {processors.map((processor) => (
                    <option key={processor.id} value={processor.id}>
                      {processor.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={processorName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => handleReportTypeChange(e.target.value as ReportType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="daily">Daily Report</option>
                <option value="paralegal_post_closing">Weekly - Paralegal & Post Closing Report</option>
                <option value="recording">Weekly - Recording Report</option>
                <option value="title">Weekly - Title Report</option>
                <option value="marlise">Weekly - Marlise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Date
              </label>
              <input
                type="date"
                name="report_date"
                value={formData.report_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {reportType === 'daily' && formData.report_type === 'daily' && (
            <>
              <div className="border-t pt-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What did you do?
                  </label>
                  <textarea
                    name="what_did_you_do"
                    value={formData.what_did_you_do}
                    onChange={handleInputChange}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe what you accomplished today..."
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What do you need help with?
                  </label>
                  <textarea
                    name="what_do_you_need_help_with"
                    value={formData.what_do_you_need_help_with}
                    onChange={handleInputChange}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe what help you need..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review thru date
                  </label>
                  <input
                    type="date"
                    name="current_date_detail_file_check"
                    value={formData.current_date_detail_file_check}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}

          {reportType === 'paralegal_post_closing' && formData.report_type === 'paralegal_post_closing' && (
            <>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Closings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purchases Closed
                    </label>
                    <input
                      type="number"
                      name="purchased_closed"
                      value={formData.purchased_closed}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Refinances Closed
                    </label>
                    <input
                      type="number"
                      name="refinances_closed"
                      value={formData.refinances_closed}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">File Counts</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Count (Refinances)
                    </label>
                    <input
                      type="number"
                      name="file_count_refi"
                      value={formData.file_count_refi}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Count (Purchases)
                    </label>
                    <input
                      type="number"
                      name="file_count_purchases"
                      value={formData.file_count_purchases}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total File Count
                    </label>
                    <input
                      type="number"
                      name="total_file_count"
                      value={formData.total_file_count}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Complete Closing Date
                  </label>
                  <input
                    type="date"
                    name="review_complete_closing_date"
                    value={formData.review_complete_closing_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unresolved Issues (Paralegal)
                  </label>
                  <textarea
                    name="unresolved_issues"
                    value={formData.unresolved_issues}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe any unresolved issues..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issues Resolved
                  </label>
                  <textarea
                    name="issues_resolved"
                    value={formData.issues_resolved}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe issues that were resolved..."
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Post Closing Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Policies Sent
                    </label>
                    <input
                      type="number"
                      name="policies_sent"
                      value={formData.policies_sent}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Save and Closed Completed
                    </label>
                    <input
                      type="number"
                      name="save_closed_completed"
                      value={formData.save_closed_completed}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number Reissued & Mail Returned Check Sent out
                    </label>
                    <input
                      type="number"
                      name="reissued_mail_returned"
                      value={formData.reissued_mail_returned}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Escrow Released
                    </label>
                    <input
                      type="number"
                      name="escrow_released"
                      value={formData.escrow_released}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Post Closings
                    </label>
                    <input
                      type="number"
                      name="number_of_post_closings"
                      value={formData.number_of_post_closings}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Any Searches Past Due and Why
                  </label>
                  <textarea
                    name="searches_past_due"
                    value={formData.searches_past_due}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe any searches that are past due and why..."
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unresolved Issues (Post Closing)
                  </label>
                  <textarea
                    name="unresolved_issues_post"
                    value={formData.unresolved_issues_post}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe any unresolved issues..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pending Policies
                  </label>
                  <textarea
                    name="pending_policies"
                    value={formData.pending_policies}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="List any pending policies..."
                  />
                </div>
              </div>
            </>
          )}

          {reportType === 'recording' && formData.report_type === 'recording' && (
            <>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Recording Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deeds Recorded
                    </label>
                    <input
                      type="number"
                      name="deeds_recorded"
                      value={formData.deeds_recorded}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mtg Recorded
                    </label>
                    <input
                      type="number"
                      name="mtg_recorded"
                      value={formData.mtg_recorded}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NOS Recorded
                    </label>
                    <input
                      type="number"
                      name="nos_recorded"
                      value={formData.nos_recorded}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Oldest File to be Recorded
                    </label>
                    <input
                      type="date"
                      name="oldest_file_recorded"
                      value={formData.oldest_file_recorded}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Date of Post Closing Recordings
                    </label>
                    <input
                      type="date"
                      name="post_closing_recordings_date"
                      value={formData.post_closing_recordings_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Date of NOS Recordings
                    </label>
                    <input
                      type="date"
                      name="nos_recordings_date"
                      value={formData.nos_recordings_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Policies & Processing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Policies Completed
                    </label>
                    <input
                      type="number"
                      name="policies_completed"
                      value={formData.policies_completed}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number Done/Printed/Mailed
                    </label>
                    <input
                      type="number"
                      name="done_printed_mailed"
                      value={formData.done_printed_mailed}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Policies Sent for Kathy
                    </label>
                    <input
                      type="number"
                      name="policies_sent_kathy"
                      value={formData.policies_sent_kathy}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Outstanding Issues
                </label>
                <textarea
                  name="outstanding_issues_recording"
                  value={formData.outstanding_issues_recording}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe any outstanding issues..."
                />
              </div>
            </>
          )}

          {reportType === 'title' && formData.report_type === 'title' && (
            <>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Title Processing</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purchases Read
                    </label>
                    <input
                      type="number"
                      name="purchases_read"
                      value={formData.purchases_read}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Refinances Read
                    </label>
                    <input
                      type="number"
                      name="refinances_read"
                      value={formData.refinances_read}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endorsements
                    </label>
                    <input
                      type="number"
                      name="endorsements"
                      value={formData.endorsements}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title Reports
                    </label>
                    <input
                      type="number"
                      name="title_reports"
                      value={formData.title_reports}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Policies
                    </label>
                    <input
                      type="number"
                      name="policies"
                      value={formData.policies}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Construction Rd's
                    </label>
                    <input
                      type="number"
                      name="construction_rds"
                      value={formData.construction_rds}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sale Doc Preps
                    </label>
                    <input
                      type="number"
                      name="sale_doc_preps"
                      value={formData.sale_doc_preps}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unresolved Issues
                  </label>
                  <textarea
                    name="unresolved_issues_title"
                    value={formData.unresolved_issues_title}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe any unresolved issues..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolved Issues
                  </label>
                  <textarea
                    name="resolved_issues_title"
                    value={formData.resolved_issues_title}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe issues that were resolved..."
                  />
                </div>
              </div>
            </>
          )}

          {reportType === 'marlise' && formData.report_type === 'marlise' && (
            <>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Weekly Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Orders Entered
                    </label>
                    <input
                      type="number"
                      name="new_orders_entered"
                      value={formData.new_orders_entered}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Files Stacked
                    </label>
                    <input
                      type="number"
                      name="number_of_files_stacked"
                      value={formData.number_of_files_stacked}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NOS Sent
                    </label>
                    <input
                      type="number"
                      name="nos_sent"
                      value={formData.nos_sent}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Enter number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unresolved Issues
                  </label>
                  <textarea
                    name="unresolved_issues"
                    value={formData.unresolved_issues}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe any unresolved issues..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolved Issues
                  </label>
                  <textarea
                    name="resolved_issues"
                    value={formData.resolved_issues}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe issues that were resolved..."
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-6 border-t">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
