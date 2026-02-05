import React, { useState, useEffect } from 'react';
import { Camera, Upload, Award, CheckCircle, XCircle, Edit2, Save, X, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getTodayDateString, nowInEST, formatDateShort } from '../lib/dateUtils';

interface Submission {
  id: string;
  file_number: string;
  submission_date: string;
  submission_type: string;
  image_url: string;
  created_at: string;
}

const SUBMISSION_TYPES = [
  { value: 'closing_photo', label: 'Picture from Closing', points: 1 },
  { value: 'google_review', label: 'Google Review', points: 2 },
  { value: 'photobooth', label: 'Photo Booth Picture', points: 1 },
];

interface Closer {
  id: string;
  full_name: string;
}

export default function CloserSubmissions() {
  const { user, salesPerson, isAdmin } = useAuth();
  const [fileNumber, setFileNumber] = useState('');
  const [submissionDate, setSubmissionDate] = useState(getTodayDateString());
  const [submissionType, setSubmissionType] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [closerName, setCloserName] = useState('');
  const [closerId, setCloserId] = useState('');
  const [closers, setClosers] = useState<Closer[]>([]);
  const [selectedCloserId, setSelectedCloserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFileNumber, setEditFileNumber] = useState('');
  const [editSubmissionType, setEditSubmissionType] = useState('');
  const [editSubmissionDate, setEditSubmissionDate] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = nowInEST();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const isAdminUser = isAdmin;

  useEffect(() => {
    loadCloserInfo();
  }, []);

  useEffect(() => {
    if (isAdminUser) {
      loadAllClosers();
    }
  }, [isAdminUser]);

  useEffect(() => {
    loadSubmissions();
  }, [selectedCloserId, selectedMonth]);

  const loadAllClosers = async () => {
    const { data, error } = await supabase
      .from('sales_people')
      .select(`
        id,
        name,
        user_module_permissions!inner(has_access)
      `)
      .eq('is_active', true)
      .eq('user_module_permissions.module_name', 'closer_submissions')
      .eq('user_module_permissions.has_access', true)
      .order('name');

    if (data) {
      const closersWithFullName = data.map(c => ({ id: c.id, full_name: c.name }));
      setClosers(closersWithFullName);
      if (data.length > 0) {
        setSelectedCloserId(data[0].id);
      }
    }
  };

  const loadCloserInfo = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('sales_people')
      .select('name, id')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setCloserName(data.name);
      setCloserId(data.id);
      if (!isAdminUser) {
        setSelectedCloserId(data.id);
      }
    }
  };

  const loadSubmissions = async () => {
    const targetCloserId = isAdminUser ? selectedCloserId : closerId;
    if (!targetCloserId) return;

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
      .eq('closer_id', targetCloserId)
      .gte('submission_date', startDate)
      .lte('submission_date', endDate)
      .order('submission_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setSubmissions(data);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fileNumber.trim()) {
      setError('File number/reference is required');
      return;
    }

    if (!submissionType) {
      setError('Please select a submission type');
      return;
    }

    if (!imageFile && submissionType !== 'photobooth') {
      setError('Please upload an image');
      return;
    }

    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);

    try {
      const targetCloserId = isAdminUser ? selectedCloserId : user.id;
      const targetCloserName = isAdminUser
        ? closers.find(c => c.id === selectedCloserId)?.full_name || closerName
        : closerName;

      let fileName = '';

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        fileName = `${targetCloserId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('closer-rewards')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
      }

      const { error: insertError } = await supabase
        .from('closer_submissions')
        .insert({
          file_number: fileNumber.trim(),
          closer_id: targetCloserId,
          closer_name: targetCloserName,
          submission_date: submissionDate,
          submission_type: submissionType,
          image_url: fileName || null,
        });

      if (insertError) throw insertError;

      setSuccess('Submission recorded successfully!');
      setFileNumber('');
      setSubmissionType('');
      setImageFile(null);
      setImagePreview('');
      setSubmissionDate(getTodayDateString());
      loadSubmissions();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionTypeLabel = (type: string) => {
    return SUBMISSION_TYPES.find(t => t.value === type)?.label || type;
  };

  const startEdit = (submission: Submission) => {
    setEditingId(submission.id);
    setEditFileNumber(submission.file_number);
    setEditSubmissionType(submission.submission_type);
    setEditSubmissionDate(submission.submission_date);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFileNumber('');
    setEditSubmissionType('');
    setEditSubmissionDate('');
    setError('');
  };

  const saveEdit = async (submissionId: string) => {
    if (!editFileNumber.trim() || !editSubmissionType || !editSubmissionDate) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('closer_submissions')
        .update({
          file_number: editFileNumber.trim(),
          submission_type: editSubmissionType,
          submission_date: editSubmissionDate,
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      setSuccess('Submission updated successfully!');
      cancelEdit();
      loadSubmissions();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteSubmission = async (submissionId: string) => {
    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('closer_submissions')
        .delete()
        .eq('id', submissionId);

      if (deleteError) throw deleteError;

      setSuccess('Submission deleted successfully!');
      setDeleteConfirmId(null);
      loadSubmissions();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculatePoints = (fileSubmissions: Submission[]) => {
    const types = new Set(fileSubmissions.map(s => s.submission_type));
    if (types.size === 3) {
      return 5;
    }
    return fileSubmissions.reduce((total, sub) => {
      const typeInfo = SUBMISSION_TYPES.find(t => t.value === sub.submission_type);
      return total + (typeInfo?.points || 0);
    }, 0);
  };

  const groupedSubmissions = submissions.reduce((acc, sub) => {
    if (!acc[sub.file_number]) {
      acc[sub.file_number] = [];
    }
    acc[sub.file_number].push(sub);
    return acc;
  }, {} as Record<string, Submission[]>);

  const totalPoints = Object.values(groupedSubmissions).reduce((total, subs) => {
    return total + calculatePoints(subs);
  }, 0);

  const totalFiles = Object.keys(groupedSubmissions).length;
  const totalBonuses = Object.values(groupedSubmissions).filter(subs => {
    const types = new Set(subs.map(s => s.submission_type));
    return types.size === 3;
  }).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Award className="w-8 h-8 text-blue-600" />
          Submit Rewards
        </h1>
        <p className="mt-2 text-gray-600">
          Submit your closing photos and reviews to earn reward points
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Point System:</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Picture from Closing = 1 point</li>
            <li>• Google Review = 2 points</li>
            <li>• Photo Booth Picture = 1 point</li>
            <li className="font-semibold mt-2">• All 3 for same file = 5 points (BONUS!)</li>
          </ul>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-gray-600" />
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
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
              <p className="text-sm text-gray-600">Files Completed</p>
              <p className="text-3xl font-bold text-green-600">{totalFiles}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bonus Files</p>
              <p className="text-3xl font-bold text-amber-600">{totalBonuses}</p>
            </div>
            <Award className="w-12 h-12 text-amber-600 opacity-20" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Submit New Entry
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdminUser && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-semibold text-purple-900 mb-2">Admin Mode</p>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select User to Submit As *
                </label>
                <select
                  value={selectedCloserId}
                  onChange={(e) => setSelectedCloserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {closers.map((closer) => (
                    <option key={closer.id} value={closer.id}>
                      {closer.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File Number\Reference *
              </label>
              <input
                type="text"
                value={fileNumber}
                onChange={(e) => setFileNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter file number or reference"
                required
              />
            </div>

            {!isAdminUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={closerName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Submission Type *
              </label>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select type...</option>
                {SUBMISSION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} ({type.points} {type.points === 1 ? 'point' : 'points'})
                  </option>
                ))}
              </select>
            </div>

            {submissionType === 'photobooth' ? (
              <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-600">
                  No image upload required for Photo Booth submissions. Just enter the file number/reference and date.
                </p>
              </div>
            ) : submissionType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Image *
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                    required
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Camera className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {imageFile ? imageFile.name : 'Choose an image...'}
                    </span>
                  </label>
                </div>
                {imagePreview && (
                  <div className="mt-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 rounded-lg border border-gray-300"
                    />
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Submit Entry
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Award className="w-5 h-5" />
            {isAdminUser && selectedCloserId
              ? `${closers.find(c => c.id === selectedCloserId)?.full_name}'s Submissions`
              : 'My Submissions'}
          </h2>

          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {Object.entries(groupedSubmissions).map(([fileNum, subs]) => {
              const points = calculatePoints(subs);
              const hasBonus = subs.length === 3 && new Set(subs.map(s => s.submission_type)).size === 3;

              return (
                <div key={fileNum} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">File #{fileNum}</div>
                      <div className="text-sm text-gray-600">
                        {formatDateShort(subs[0].submission_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${hasBonus ? 'text-green-600' : 'text-blue-600'}`}>
                        {points} pts
                      </div>
                      {hasBonus && (
                        <div className="text-xs text-green-600 font-semibold">BONUS!</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {subs.map((sub) => {
                      const isEditing = editingId === sub.id;

                      return (
                        <div key={sub.id}>
                          {isEditing ? (
                            <div className="space-y-2 p-2 bg-gray-50 rounded border border-gray-300">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  File Number\Reference
                                </label>
                                <input
                                  type="text"
                                  value={editFileNumber}
                                  onChange={(e) => setEditFileNumber(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={editSubmissionDate}
                                  onChange={(e) => setEditSubmissionDate(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Submission Type
                                </label>
                                <select
                                  value={editSubmissionType}
                                  onChange={(e) => setEditSubmissionType(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {SUBMISSION_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEdit(sub.id)}
                                  disabled={loading}
                                  className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={loading}
                                  className="flex-1 bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-700 flex items-center justify-between gap-2 py-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <span>{getSubmissionTypeLabel(sub.submission_type)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEdit(sub)}
                                  className="text-gray-500 hover:text-blue-600 transition-colors p-1"
                                  title="Edit submission"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(sub.id)}
                                  className="text-gray-500 hover:text-red-600 transition-colors p-1"
                                  title="Delete submission"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {submissions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No submissions yet</p>
                <p className="text-sm mt-1">Start earning points by submitting your first entry!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Submission</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this submission? This action cannot be undone and will affect your point total.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteSubmission(deleteConfirmId)}
                disabled={loading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
