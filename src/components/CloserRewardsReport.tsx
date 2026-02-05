import React, { useState, useEffect } from 'react';
import { Award, Download, Calendar, TrendingUp, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { nowInEST, getESTToday, formatDateShort } from '../lib/dateUtils';

interface Submission {
  id: string;
  file_number: string;
  closer_id: string;
  closer_name: string;
  submission_date: string;
  submission_type: string;
  image_url: string;
  created_at: string;
}

interface CloserStats {
  closerId: string;
  closerName: string;
  totalPoints: number;
  totalSubmissions: number;
  fileCount: number;
  bonusCount: number;
  submissions: Submission[];
}

const SUBMISSION_TYPES = [
  { value: 'closing_photo', label: 'Picture from Closing', points: 1 },
  { value: 'google_review', label: 'Google Review', points: 2 },
  { value: 'photobooth', label: 'Photo Booth Picture', points: 1 },
];

export default function CloserRewardsReport() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = nowInEST();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [selectedMonth]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);
      const endYear = lastDayOfMonth.getFullYear();
      const endMonth = String(lastDayOfMonth.getMonth() + 1).padStart(2, '0');
      const endDay = String(lastDayOfMonth.getDate()).padStart(2, '0');
      const endDate = `${endYear}-${endMonth}-${endDay}`;

      const { data, error } = await supabase
        .from('closer_submissions')
        .select('*')
        .gte('submission_date', startDate)
        .lte('submission_date', endDate)
        .order('closer_name')
        .order('submission_date', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCloserStats = (): CloserStats[] => {
    const closerMap = new Map<string, CloserStats>();

    submissions.forEach(sub => {
      if (!closerMap.has(sub.closer_id)) {
        closerMap.set(sub.closer_id, {
          closerId: sub.closer_id,
          closerName: sub.closer_name,
          totalPoints: 0,
          totalSubmissions: 0,
          fileCount: 0,
          bonusCount: 0,
          submissions: [],
        });
      }

      const stats = closerMap.get(sub.closer_id)!;
      stats.submissions.push(sub);
      stats.totalSubmissions++;
    });

    closerMap.forEach(stats => {
      const fileGroups = stats.submissions.reduce((acc, sub) => {
        if (!acc[sub.file_number]) {
          acc[sub.file_number] = [];
        }
        acc[sub.file_number].push(sub);
        return acc;
      }, {} as Record<string, Submission[]>);

      stats.fileCount = Object.keys(fileGroups).length;

      Object.values(fileGroups).forEach(fileSubs => {
        const types = new Set(fileSubs.map(s => s.submission_type));
        if (types.size === 3) {
          stats.totalPoints += 5;
          stats.bonusCount++;
        } else {
          fileSubs.forEach(sub => {
            const typeInfo = SUBMISSION_TYPES.find(t => t.value === sub.submission_type);
            stats.totalPoints += typeInfo?.points || 0;
          });
        }
      });
    });

    return Array.from(closerMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  };

  const getSubmissionTypeLabel = (type: string) => {
    return SUBMISSION_TYPES.find(t => t.value === type)?.label || type;
  };

  const viewImage = async (imageUrl: string) => {
    try {
      const { data } = await supabase.storage
        .from('closer-rewards')
        .createSignedUrl(imageUrl, 300);

      if (data?.signedUrl) {
        setViewingImage(data.signedUrl);
      }
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const exportToExcel = () => {
    const stats = calculateCloserStats();

    const data = [
      ['Closer Name', 'Total Points', 'Files Completed', 'Total Submissions', 'Bonus Files (All 3 Types)'],
      ...stats.map(s => [
        s.closerName,
        s.totalPoints,
        s.fileCount,
        s.totalSubmissions,
        s.bonusCount,
      ]),
      [],
      ['Total Points:', stats.reduce((sum, s) => sum + s.totalPoints, 0), '', '', ''],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Closer Rewards');
    XLSX.writeFile(workbook, `closer-rewards-${selectedMonth}.xlsx`);
  };

  const stats = calculateCloserStats();
  const totalPoints = stats.reduce((sum, s) => sum + s.totalPoints, 0);
  const totalBonuses = stats.reduce((sum, s) => sum + s.bonusCount, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Award className="w-8 h-8 text-blue-600" />
          Closer Rewards Report
        </h1>
        <p className="mt-2 text-gray-600">
          Monthly summary of closer submissions and reward points
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-600" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={exportToExcel}
          disabled={loading || stats.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Points</p>
              <p className="text-3xl font-bold text-blue-600">{totalPoints}</p>
            </div>
            <Award className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Closers</p>
              <p className="text-3xl font-bold text-green-600">{stats.length}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bonus Files</p>
              <p className="text-3xl font-bold text-purple-600">{totalBonuses}</p>
            </div>
            <Award className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-500">Loading submissions...</div>
        </div>
      ) : stats.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No submissions found for this month</p>
        </div>
      ) : (
        <div className="space-y-6">
          {stats.map((closer) => {
            const fileGroups = closer.submissions.reduce((acc, sub) => {
              if (!acc[sub.file_number]) {
                acc[sub.file_number] = [];
              }
              acc[sub.file_number].push(sub);
              return acc;
            }, {} as Record<string, Submission[]>);

            return (
              <div key={closer.closerId} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{closer.closerName}</h2>
                      <p className="text-blue-100 mt-1">
                        {closer.fileCount} files • {closer.totalSubmissions} submissions
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold">{closer.totalPoints}</div>
                      <div className="text-blue-100">points</div>
                      {closer.bonusCount > 0 && (
                        <div className="text-sm mt-1 text-yellow-300 font-semibold">
                          {closer.bonusCount} BONUS {closer.bonusCount === 1 ? 'FILE' : 'FILES'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">File Details:</h3>
                  <div className="space-y-4">
                    {Object.entries(fileGroups).map(([fileNum, fileSubs]) => {
                      const types = new Set(fileSubs.map(s => s.submission_type));
                      const hasBonus = types.size === 3;
                      const points = hasBonus ? 5 : fileSubs.reduce((sum, sub) => {
                        const typeInfo = SUBMISSION_TYPES.find(t => t.value === sub.submission_type);
                        return sum + (typeInfo?.points || 0);
                      }, 0);

                      return (
                        <div
                          key={fileNum}
                          className={`border rounded-lg p-4 ${
                            hasBonus ? 'border-green-300 bg-green-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-semibold text-gray-900">File #{fileNum}</div>
                              <div className="text-sm text-gray-600">
                                {formatDateShort(fileSubs[0].submission_date)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-xl font-bold ${hasBonus ? 'text-green-600' : 'text-blue-600'}`}>
                                {points} pts
                              </div>
                              {hasBonus && (
                                <div className="text-xs text-green-600 font-semibold">BONUS!</div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {fileSubs.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2 text-sm">
                                {sub.image_url ? (
                                  <button
                                    onClick={() => viewImage(sub.image_url)}
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    {getSubmissionTypeLabel(sub.submission_type)}
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-2 text-gray-600">
                                    <ImageIcon className="w-4 h-4" />
                                    {getSubmissionTypeLabel(sub.submission_type)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={viewingImage}
              alt="Submission"
              className="max-w-full max-h-[90vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
