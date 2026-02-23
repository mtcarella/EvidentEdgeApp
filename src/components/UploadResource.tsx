import { useState, useEffect } from 'react';
import { Upload, Loader, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';

interface ResourceCategory {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function UploadResource() {
  const { salesPerson } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [uploadForm, setUploadForm] = useState<{
    title: string;
    category: string;
    file: File | null;
  }>({
    title: '',
    category: '',
    file: null,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('resource_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      setCategories(data || []);
      if (data && data.length > 0 && !uploadForm.category) {
        setUploadForm(prev => ({ ...prev, category: data[0].name }));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setUploadError('Please select a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File size must be less than 10MB');
        return;
      }
      setUploadForm({ ...uploadForm, file });
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title.trim() || !salesPerson?.id || !uploadForm.category) return;

    setUploading(true);
    setUploadError(null);

    try {
      const fileName = `${Date.now()}_${uploadForm.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${uploadForm.category}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('resources')
        .upload(filePath, uploadForm.file);

      if (uploadErr) throw uploadErr;

      const { error: dbError } = await supabase
        .from('resources')
        .insert({
          title: uploadForm.title.trim(),
          category: uploadForm.category,
          file_path: filePath,
          file_size: uploadForm.file.size,
          uploaded_by: salesPerson.id,
        });

      if (dbError) {
        await supabase.storage.from('resources').remove([filePath]);
        throw dbError;
      }

      setUploadForm({
        title: '',
        category: categories.length > 0 ? categories[0].name : '',
        file: null,
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      setNotification({ type: 'success', message: 'Resource uploaded successfully!' });
    } catch (error: unknown) {
      console.error('Error uploading resource:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload resource';
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (loadingCategories) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Upload Resource</h2>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-rose-600" />
          Upload New Resource
        </h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={uploadForm.category}
              onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PDF File (Max 10MB)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
            />
          </div>
          {uploadError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {uploadError}
            </div>
          )}
          <button
            type="submit"
            disabled={uploading || !uploadForm.file || !uploadForm.title.trim() || !uploadForm.category}
            className="w-full bg-rose-600 text-white py-2 px-4 rounded-lg hover:bg-rose-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Upload Resource
              </>
            )}
          </button>
        </form>
      </div>

      {notification && (
        <Toast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
