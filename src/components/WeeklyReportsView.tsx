import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, Calendar, Filter, Trash2, CreditCard as Edit2, X, Save, CheckSquare, Square, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import * as XLSX from 'xlsx';
import { formatDateForDisplay, formatTimestampForDisplay, getTodayDateString } from '../lib/dateUtils';
import { useModulePermissions } from '../hooks/useModulePermissions';

type ReportType = 'paralegal_post_closing' | 'recording' | 'title' | 'daily' | 'marlise';

interface BaseWeeklyReport {
  id: string;
  processor_id: string;
  processor_name: string;
  report_date: string;
  report_type: ReportType;
  created_at: string;
}

interface ParalegalReport extends BaseWeeklyReport {
  report_type: 'paralegal_post_closing';
  purchased_closed: number;
  refinances_closed: number;
  file_count_refi: number;
  file_count_purchases: number;
  total_file_count: number;
  review_complete_closing_date: string | null;
  unresolved_issues: string;
  issues_resolved: string;
  policies_sent: number;
  save_closed_completed: number;
  searches_past_due: string;
  reissued_mail_returned: number;
  escrow_released: number;
  number_of_post_closings: number;
  unresolved_issues_post: string;
  pending_policies: string;
}

interface RecordingReport extends BaseWeeklyReport {
  report_type: 'recording';
  deeds_recorded: number;
  mtg_recorded: number;
  nos_recorded: number;
  oldest_file_recorded: string;
  post_closing_recordings_date: string | null;
  nos_recordings_date: string | null;
  policies_completed: number;
  done_printed_mailed: number;
  policies_sent_kathy: number;
  outstanding_issues_recording: string;
}

interface TitleReport extends BaseWeeklyReport {
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

interface DailyReport extends BaseWeeklyReport {
  report_type: 'daily';
  what_did_you_do: string;
  what_do_you_need_help_with: string;
}

interface MarliseReport extends BaseWeeklyReport {
  report_type: 'marlise';
  new_orders_entered: number;
  number_of_files_stacked: number;
  nos_sent: number;
  unresolved_issues: string;
  resolved_issues: string;
}

type WeeklyReport = ParalegalReport | RecordingReport | TitleReport | DailyReport | MarliseReport;

export default function WeeklyReportsView() {
  const { user, isAdmin, isSuperAdmin, salesPersonId } = useAuth();
  const { hasAccess, loading: permissionsLoading, permissions } = useModulePermissions(user?.id, salesPersonId);
  const dialog = useDialog();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcessor, setSelectedProcessor] = useState<string>('all');
  const [selectedReportType, setSelectedReportType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [processors, setProcessors] = useState<string[]>([]);
  const [currentProcessorId, setCurrentProcessorId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null);
  const [viewingReport, setViewingReport] = useState<WeeklyReport | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<WeeklyReport>>({});
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReports();
    fetchCurrentProcessorId();
  }, [user]);

  useEffect(() => {
    if (!permissionsLoading) {
      applyFilters();
    }
  }, [reports, selectedProcessor, selectedReportType, dateFrom, dateTo, permissions, permissionsLoading]);

  const fetchCurrentProcessorId = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('sales_people')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching processor info:', error);
      return;
    }

    if (data) {
      setCurrentProcessorId(data.id);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_performance_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReports(data || []);

      const uniqueProcessors = Array.from(new Set(data?.map(r => r.processor_name) || []));
      setProcessors(uniqueProcessors);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    // Filter out OTHER people's daily reports if user doesn't have permission to view them
    // Users can always see their own daily reports
    // Admins and super admins can always view all reports
    if (!isAdmin && !isSuperAdmin && !hasAccess('view_daily_reports')) {
      filtered = filtered.filter(r =>
        r.report_type !== 'daily' || r.processor_id === currentProcessorId
      );
    }

    if (selectedProcessor !== 'all') {
      filtered = filtered.filter(r => r.processor_name === selectedProcessor);
    }

    if (selectedReportType !== 'all') {
      filtered = filtered.filter(r => r.report_type === selectedReportType);
    }

    if (dateFrom) {
      filtered = filtered.filter(r => r.report_date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(r => r.report_date <= dateTo);
    }

    setFilteredReports(filtered);
    setSelectedReportIds(new Set());
  };

  const getReportTypeLabel = (type: ReportType) => {
    switch (type) {
      case 'daily':
        return 'Daily Report';
      case 'paralegal_post_closing':
        return 'Paralegal/Post-Closing Report';
      case 'recording':
        return 'Recording Report';
      case 'title':
        return 'Title Report';
      case 'marlise':
        return 'Weekly - Marlise';
      default:
        return type;
    }
  };

  const toggleReportSelection = (reportId: string) => {
    const newSelected = new Set(selectedReportIds);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReportIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedReportIds.size === filteredReports.length) {
      setSelectedReportIds(new Set());
    } else {
      setSelectedReportIds(new Set(filteredReports.map(r => r.id)));
    }
  };

  const isAllSelected = filteredReports.length > 0 && selectedReportIds.size === filteredReports.length;

  const handleDelete = async (reportId: string) => {
    if (!(await dialog.confirm('Are you sure you want to delete this report?'))) return;

    try {
      const { error } = await supabase
        .from('weekly_performance_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      setReports(reports.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
      await dialog.alert('Failed to delete report');
    }
  };

  const handleEditClick = (report: WeeklyReport) => {
    setEditingReport(report);
    setEditFormData({
      report_date: report.report_date,
      purchased_closed: report.purchased_closed,
      refinances_closed: report.refinances_closed,
      file_count_refi: report.file_count_refi,
      file_count_purchases: report.file_count_purchases,
      total_file_count: report.total_file_count,
      review_complete_closing_date: report.review_complete_closing_date || '',
      unresolved_issues: report.unresolved_issues,
      issues_resolved: report.issues_resolved,
    });
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseInt(value)) : value
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;

    try {
      const { error } = await supabase
        .from('weekly_performance_reports')
        .update(editFormData)
        .eq('id', editingReport.id);

      if (error) throw error;

      const updatedReports = reports.map(r =>
        r.id === editingReport.id ? { ...r, ...editFormData } : r
      );
      setReports(updatedReports);
      setEditingReport(null);
      setEditFormData({});
      await dialog.alert('Report updated successfully!');
    } catch (error) {
      console.error('Error updating report:', error);
      await dialog.alert('Failed to update report');
    }
  };

  const canEditReport = (report: WeeklyReport) => {
    return currentProcessorId === report.processor_id || isAdmin;
  };

  const exportToExcel = async () => {
    const reportsToExport = filteredReports.filter(report => selectedReportIds.has(report.id));

    if (reportsToExport.length === 0) {
      await dialog.alert('Please select at least one report to export');
      return;
    }

    const exportData = reportsToExport.map(report => ({
      'Processor Name': report.processor_name,
      'Report Date': formatDateForDisplay(report.report_date),
      'Purchases Closed': report.purchased_closed,
      'Refinances Closed': report.refinances_closed,
      'File Count (Refi)': report.file_count_refi,
      'File Count (Purchases)': report.file_count_purchases,
      'Total File Count': report.total_file_count,
      'Review Complete Closing Date': report.review_complete_closing_date
        ? formatDateForDisplay(report.review_complete_closing_date)
        : '',
      'Unresolved Issues': report.unresolved_issues,
      'Issues Resolved': report.issues_resolved,
      'Submitted At': formatTimestampForDisplay(report.created_at)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weekly Reports');

    const colWidths = [
      { wch: 20 }, // Processor Name
      { wch: 15 }, // Report Date
      { wch: 18 }, // Purchases Closed
      { wch: 18 }, // Refinances Closed
      { wch: 18 }, // File Count (Refi)
      { wch: 22 }, // File Count (Purchases)
      { wch: 18 }, // Total File Count
      { wch: 25 }, // Review Complete Closing Date
      { wch: 40 }, // Unresolved Issues
      { wch: 40 }, // Issues Resolved
      { wch: 20 }, // Submitted At
    ];
    worksheet['!cols'] = colWidths;

    const fileName = `weekly_reports_${getTodayDateString()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };


  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Performance Reports</h2>
          </div>
          <button
            onClick={exportToExcel}
            disabled={selectedReportIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {selectedReportIds.size > 0
              ? `Export ${selectedReportIds.size} Selected`
              : 'Export to Excel'}
          </button>
        </div>

        <div className={`grid grid-cols-1 ${(isAdmin || isSuperAdmin) ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6 p-4 bg-gray-50 rounded-lg`}>
          {(isAdmin || isSuperAdmin) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Processor
              </label>
              <select
                value={selectedProcessor}
                onChange={(e) => setSelectedProcessor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Processors</option>
                {processors.map(processor => (
                  <option key={processor} value={processor}>{processor}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Report Type
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="daily">Daily Report</option>
              <option value="paralegal_post_closing">Paralegal/Post-Closing Report</option>
              <option value="recording">Recording Report</option>
              <option value="title">Title Report</option>
              <option value="marlise">Weekly - Marlise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {!(isAdmin || isSuperAdmin) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              You are viewing your own reports only. Contact an administrator to view other reports.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            Showing {filteredReports.length} of {reports.length} reports
          </div>
          {filteredReports.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {filteredReports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No reports found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => toggleReportSelection(report.id)}
                      className="mt-1 text-blue-600 hover:text-blue-800 transition-colors"
                      title={selectedReportIds.has(report.id) ? 'Deselect report' : 'Select report'}
                    >
                      {selectedReportIds.has(report.id) ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-800">{report.processor_name}</h3>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {getReportTypeLabel(report.report_type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Report Date: {formatDateForDisplay(report.report_date)} |
                        Submitted: {formatTimestampForDisplay(report.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingReport(report)}
                      className="text-green-600 hover:text-green-800 transition-colors"
                      title="View Report"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {canEditReport(report) && (
                      <button
                        onClick={() => handleEditClick(report)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Edit Report"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete Report"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {report.report_type === 'paralegal_post_closing' && (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Closing Statistics</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Purchases Closed</p>
                          <p className="text-2xl font-bold text-blue-600">{report.purchased_closed}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Refinances Closed</p>
                          <p className="text-2xl font-bold text-green-600">{report.refinances_closed}</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">File Count (Refi)</p>
                          <p className="text-2xl font-bold text-orange-600">{report.file_count_refi}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">File Count (Purchases)</p>
                          <p className="text-2xl font-bold text-purple-600">{report.file_count_purchases}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Post-Closing Statistics</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Policies Sent</p>
                          <p className="text-2xl font-bold text-blue-600">{report.policies_sent}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Save & Closed</p>
                          <p className="text-2xl font-bold text-green-600">{report.save_closed_completed}</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Reissued & Returned</p>
                          <p className="text-2xl font-bold text-orange-600">{report.reissued_mail_returned}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Escrow Released</p>
                          <p className="text-2xl font-bold text-purple-600">{report.escrow_released}</p>
                        </div>
                        <div className="bg-pink-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Post Closings</p>
                          <p className="text-2xl font-bold text-pink-600">{report.number_of_post_closings}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Total File Count</p>
                        <p className="text-lg font-semibold text-gray-900">{report.total_file_count}</p>
                      </div>
                      {report.review_complete_closing_date && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Review Complete Closing Date</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDateForDisplay(report.review_complete_closing_date)}</p>
                        </div>
                      )}
                    </div>
                    {report.unresolved_issues && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Unresolved Issues (Paralegal)</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-2 rounded">{report.unresolved_issues}</p>
                      </div>
                    )}
                    {report.issues_resolved && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Issues Resolved (Paralegal)</p>
                        <p className="text-sm text-gray-600 bg-green-50 p-2 rounded">{report.issues_resolved}</p>
                      </div>
                    )}
                    {report.unresolved_issues_post && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Unresolved Issues (Post-Closing)</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-2 rounded">{report.unresolved_issues_post}</p>
                      </div>
                    )}
                    {report.searches_past_due && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Searches Past Due</p>
                        <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">{report.searches_past_due}</p>
                      </div>
                    )}
                    {report.pending_policies && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Pending Policies</p>
                        <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded">{report.pending_policies}</p>
                      </div>
                    )}
                  </>
                )}

                {report.report_type === 'recording' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Deeds Recorded</p>
                        <p className="text-2xl font-bold text-blue-600">{report.deeds_recorded}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Mtg Recorded</p>
                        <p className="text-2xl font-bold text-green-600">{report.mtg_recorded}</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">NOS Recorded</p>
                        <p className="text-2xl font-bold text-orange-600">{report.nos_recorded}</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Policies Completed</p>
                        <p className="text-2xl font-bold text-purple-600">{report.policies_completed}</p>
                      </div>
                      <div className="bg-pink-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Done/Printed/Mailed</p>
                        <p className="text-2xl font-bold text-pink-600">{report.done_printed_mailed}</p>
                      </div>
                      <div className="bg-indigo-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Policies for Kathy</p>
                        <p className="text-2xl font-bold text-indigo-600">{report.policies_sent_kathy}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {report.oldest_file_recorded && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Oldest File Recorded</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDateForDisplay(report.oldest_file_recorded)}</p>
                        </div>
                      )}
                      {report.post_closing_recordings_date && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Post Closing Recordings Date</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDateForDisplay(report.post_closing_recordings_date)}</p>
                        </div>
                      )}
                      {report.nos_recordings_date && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">NOS Recordings Date</p>
                          <p className="text-lg font-semibold text-gray-900">{formatDateForDisplay(report.nos_recordings_date)}</p>
                        </div>
                      )}
                    </div>
                    {report.outstanding_issues_recording && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Outstanding Issues</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-2 rounded">{report.outstanding_issues_recording}</p>
                      </div>
                    )}
                  </>
                )}

                {report.report_type === 'title' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Purchases Read</p>
                        <p className="text-2xl font-bold text-blue-600">{report.purchases_read}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Refinances Read</p>
                        <p className="text-2xl font-bold text-green-600">{report.refinances_read}</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Endorsements</p>
                        <p className="text-2xl font-bold text-orange-600">{report.endorsements}</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Title Reports</p>
                        <p className="text-2xl font-bold text-purple-600">{report.title_reports}</p>
                      </div>
                      <div className="bg-pink-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Policies</p>
                        <p className="text-2xl font-bold text-pink-600">{report.policies}</p>
                      </div>
                      <div className="bg-indigo-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Construction Rd's</p>
                        <p className="text-2xl font-bold text-indigo-600">{report.construction_rds}</p>
                      </div>
                      <div className="bg-teal-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Sale Doc Preps</p>
                        <p className="text-2xl font-bold text-teal-600">{report.sale_doc_preps}</p>
                      </div>
                    </div>
                    {report.unresolved_issues_title && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Unresolved Issues</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-2 rounded">{report.unresolved_issues_title}</p>
                      </div>
                    )}
                    {report.resolved_issues_title && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Resolved Issues</p>
                        <p className="text-sm text-gray-600 bg-green-50 p-2 rounded">{report.resolved_issues_title}</p>
                      </div>
                    )}
                  </>
                )}

                {report.report_type === 'daily' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">What did you do?</p>
                        <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded whitespace-pre-wrap">{report.what_did_you_do}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">What do you need help with?</p>
                        <p className="text-sm text-gray-600 bg-amber-50 p-3 rounded whitespace-pre-wrap">{report.what_do_you_need_help_with}</p>
                      </div>
                    </div>
                  </>
                )}

                {report.report_type === 'marlise' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">New Orders Entered</p>
                        <p className="text-2xl font-bold text-blue-600">{report.new_orders_entered}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">Number of Files Stacked</p>
                        <p className="text-2xl font-bold text-green-600">{report.number_of_files_stacked}</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <p className="text-xs text-gray-600 mb-1">NOS Sent</p>
                        <p className="text-2xl font-bold text-orange-600">{report.nos_sent}</p>
                      </div>
                    </div>
                    {report.unresolved_issues && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Unresolved Issues</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-2 rounded">{report.unresolved_issues}</p>
                      </div>
                    )}
                    {report.resolved_issues && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Resolved Issues</p>
                        <p className="text-sm text-gray-600 bg-green-50 p-2 rounded">{report.resolved_issues}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Edit Weekly Report</h3>
              <button
                onClick={() => setEditingReport(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Processor Name
                  </label>
                  <input
                    type="text"
                    value={editingReport.processor_name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Date
                  </label>
                  <input
                    type="date"
                    name="report_date"
                    value={editFormData.report_date}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

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
                      value={editFormData.purchased_closed}
                      onChange={handleEditInputChange}
                      min="0"
                      required
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
                      value={editFormData.refinances_closed}
                      onChange={handleEditInputChange}
                      min="0"
                      required
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
                      value={editFormData.file_count_refi}
                      onChange={handleEditInputChange}
                      min="0"
                      required
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
                      value={editFormData.file_count_purchases}
                      onChange={handleEditInputChange}
                      min="0"
                      required
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
                      value={editFormData.total_file_count}
                      onChange={handleEditInputChange}
                      min="0"
                      required
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
                    value={editFormData.review_complete_closing_date}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unresolved Issues
                  </label>
                  <textarea
                    name="unresolved_issues"
                    value={editFormData.unresolved_issues}
                    onChange={handleEditInputChange}
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
                    value={editFormData.issues_resolved}
                    onChange={handleEditInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe issues that were resolved..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{viewingReport.processor_name}</h3>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded inline-block mt-1">
                  {getReportTypeLabel(viewingReport.report_type)}
                </span>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Report Date</p>
                  <p className="text-lg font-semibold text-gray-900">{formatDateForDisplay(viewingReport.report_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Submitted At</p>
                  <p className="text-lg font-semibold text-gray-900">{formatTimestampForDisplay(viewingReport.created_at)}</p>
                </div>
              </div>

              {viewingReport.report_type === 'daily' && (() => {
                const report = viewingReport as DailyReport;
                return (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">What did you do?</h4>
                      <p className="text-sm text-gray-700 bg-blue-50 p-4 rounded-lg whitespace-pre-wrap">
                        {report.what_did_you_do}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">What do you need help with?</h4>
                      <p className="text-sm text-gray-700 bg-amber-50 p-4 rounded-lg whitespace-pre-wrap">
                        {report.what_do_you_need_help_with}
                      </p>
                    </div>
                  </>
                );
              })()}

              {viewingReport.report_type === 'paralegal_post_closing' && (() => {
                const report = viewingReport as ParalegalReport;
                return (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Closing Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Purchases Closed</p>
                          <p className="text-3xl font-bold text-blue-600">{report.purchased_closed}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Refinances Closed</p>
                          <p className="text-3xl font-bold text-green-600">{report.refinances_closed}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">File Count (Refi)</p>
                          <p className="text-3xl font-bold text-orange-600">{report.file_count_refi}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">File Count (Purchases)</p>
                          <p className="text-3xl font-bold text-purple-600">{report.file_count_purchases}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Post-Closing Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Policies Sent</p>
                          <p className="text-3xl font-bold text-blue-600">{report.policies_sent}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Save & Closed</p>
                          <p className="text-3xl font-bold text-green-600">{report.save_closed_completed}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Reissued & Returned</p>
                          <p className="text-3xl font-bold text-orange-600">{report.reissued_mail_returned}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Escrow Released</p>
                          <p className="text-3xl font-bold text-purple-600">{report.escrow_released}</p>
                        </div>
                        <div className="bg-pink-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Post Closings</p>
                          <p className="text-3xl font-bold text-pink-600">{report.number_of_post_closings}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">File Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Total File Count</p>
                          <p className="text-2xl font-bold text-gray-900">{report.total_file_count}</p>
                        </div>
                        {report.review_complete_closing_date && (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Review Complete Closing Date</p>
                            <p className="text-2xl font-bold text-gray-900">{formatDateForDisplay(report.review_complete_closing_date)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {report.unresolved_issues && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Unresolved Issues (Paralegal)</h4>
                        <p className="text-sm text-gray-700 bg-red-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.unresolved_issues}
                        </p>
                      </div>
                    )}
                    {report.issues_resolved && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Issues Resolved (Paralegal)</h4>
                        <p className="text-sm text-gray-700 bg-green-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.issues_resolved}
                        </p>
                      </div>
                    )}
                    {report.unresolved_issues_post && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Unresolved Issues (Post-Closing)</h4>
                        <p className="text-sm text-gray-700 bg-red-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.unresolved_issues_post}
                        </p>
                      </div>
                    )}
                    {report.searches_past_due && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Searches Past Due</h4>
                        <p className="text-sm text-gray-700 bg-yellow-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.searches_past_due}
                        </p>
                      </div>
                    )}
                    {report.pending_policies && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Pending Policies</h4>
                        <p className="text-sm text-gray-700 bg-blue-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.pending_policies}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              {viewingReport.report_type === 'recording' && (() => {
                const report = viewingReport as RecordingReport;
                return (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Recording Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Deeds Recorded</p>
                          <p className="text-3xl font-bold text-blue-600">{report.deeds_recorded}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Mtg Recorded</p>
                          <p className="text-3xl font-bold text-green-600">{report.mtg_recorded}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">NOS Recorded</p>
                          <p className="text-3xl font-bold text-orange-600">{report.nos_recorded}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Policies Completed</p>
                          <p className="text-3xl font-bold text-purple-600">{report.policies_completed}</p>
                        </div>
                        <div className="bg-pink-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Done/Printed/Mailed</p>
                          <p className="text-3xl font-bold text-pink-600">{report.done_printed_mailed}</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Policies for Kathy</p>
                          <p className="text-3xl font-bold text-indigo-600">{report.policies_sent_kathy}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Important Dates</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {report.oldest_file_recorded && (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Oldest File Recorded</p>
                            <p className="text-lg font-bold text-gray-900">{formatDateForDisplay(report.oldest_file_recorded)}</p>
                          </div>
                        )}
                        {report.post_closing_recordings_date && (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Post Closing Recordings Date</p>
                            <p className="text-lg font-bold text-gray-900">{formatDateForDisplay(report.post_closing_recordings_date)}</p>
                          </div>
                        )}
                        {report.nos_recordings_date && (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">NOS Recordings Date</p>
                            <p className="text-lg font-bold text-gray-900">{formatDateForDisplay(report.nos_recordings_date)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {report.outstanding_issues_recording && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Outstanding Issues</h4>
                        <p className="text-sm text-gray-700 bg-red-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.outstanding_issues_recording}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              {viewingReport.report_type === 'title' && (() => {
                const report = viewingReport as TitleReport;
                return (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Title Work Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Purchases Read</p>
                          <p className="text-3xl font-bold text-blue-600">{report.purchases_read}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Refinances Read</p>
                          <p className="text-3xl font-bold text-green-600">{report.refinances_read}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Endorsements</p>
                          <p className="text-3xl font-bold text-orange-600">{report.endorsements}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Title Reports</p>
                          <p className="text-3xl font-bold text-purple-600">{report.title_reports}</p>
                        </div>
                        <div className="bg-pink-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Policies</p>
                          <p className="text-3xl font-bold text-pink-600">{report.policies}</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Construction Rd's</p>
                          <p className="text-3xl font-bold text-indigo-600">{report.construction_rds}</p>
                        </div>
                        <div className="bg-teal-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Sale Doc Preps</p>
                          <p className="text-3xl font-bold text-teal-600">{report.sale_doc_preps}</p>
                        </div>
                      </div>
                    </div>
                    {report.unresolved_issues_title && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Unresolved Issues</h4>
                        <p className="text-sm text-gray-700 bg-red-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.unresolved_issues_title}
                        </p>
                      </div>
                    )}
                    {report.resolved_issues_title && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Resolved Issues</h4>
                        <p className="text-sm text-gray-700 bg-green-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.resolved_issues_title}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              {viewingReport.report_type === 'marlise' && (() => {
                const report = viewingReport as MarliseReport;
                return (
                  <>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Weekly Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">New Orders Entered</p>
                          <p className="text-3xl font-bold text-blue-600">{report.new_orders_entered}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Number of Files Stacked</p>
                          <p className="text-3xl font-bold text-green-600">{report.number_of_files_stacked}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">NOS Sent</p>
                          <p className="text-3xl font-bold text-orange-600">{report.nos_sent}</p>
                        </div>
                      </div>
                    </div>
                    {report.unresolved_issues && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Unresolved Issues</h4>
                        <p className="text-sm text-gray-700 bg-red-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.unresolved_issues}
                        </p>
                      </div>
                    )}
                    {report.resolved_issues && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Resolved Issues</h4>
                        <p className="text-sm text-gray-700 bg-green-50 p-4 rounded-lg whitespace-pre-wrap">
                          {report.resolved_issues}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setViewingReport(null)}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
