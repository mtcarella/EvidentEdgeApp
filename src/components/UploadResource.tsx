import { useState, useEffect } from 'react';
import { Upload, Loader, AlertCircle, FileText, Video, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './Toast';

type ResourceType = 'pdf' | 'video' | 'link';

const ALLOWED_FILE_TYPES = {
  pdf: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    label: 'PDF',
    maxSize: 10 * 1024 * 1024,
  },
  video: {
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'],
    extensions: ['.mp4', '.webm', '.mov', '.avi', '.wmv'],
    label: 'Video',
    maxSize: 100 * 1024 * 1024,
  }
};

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
    fileType: ResourceType;
    url: string;
  }>({
    title: '',
    category: '',
    file: null,
    fileType: 'pdf',
    url: '',
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
      const config = ALLOWED_FILE_TYPES[uploadForm.fileType];
      const isValidType = config.mimeTypes.includes(file.type) ||
        config.extensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isValidType) {
        setUploadError(`Please select a valid ${config.label} file (${config.extensions.join(', ')})`);
        return;
      }

      const maxSizeMB = config.maxSize / (1024 * 1024);
      if (file.size > config.maxSize) {
        setUploadError(`File size must be less than ${maxSizeMB}MB`);
        return;
      }
      setUploadForm({ ...uploadForm, file });
      setUploadError(null);
    }
  };

  const handleFileTypeChange = (fileType: ResourceType) => {
    setUploadForm({ ...uploadForm, fileType, file: null, url: '' });
    setUploadError(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !salesPerson?.id || !uploadForm.category) return;

    if (uploadForm.fileType === 'link') {
      if (!uploadForm.url.trim() || !isValidUrl(uploadForm.url.trim())) {
        setUploadError('Please enter a valid URL (starting with http:// or https://)');
        return;
      }
    } else {
      if (!uploadForm.file) return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      if (uploadForm.fileType === 'link') {
        const { error: dbError } = await supabase
          .from('resources')
          .insert({
            title: uploadForm.title.trim(),
            category: uploadForm.category,
            file_path: uploadForm.url.trim(),
            file_size: 0,
            uploaded_by: salesPerson.id,
          });

        if (dbError) throw dbError;
      } else {
        const fileName = `${Date.now()}_${uploadForm.file!.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `${uploadForm.category}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('resources')
          .upload(filePath, uploadForm.file!);

        if (uploadErr) throw uploadErr;

        const { error: dbError } = await supabase
          .from('resources')
          .insert({
            title: uploadForm.title.trim(),
            category: uploadForm.category,
            file_path: filePath,
            file_size: uploadForm.file!.size,
            uploaded_by: salesPerson.id,
          });

        if (dbError) {
          await supabase.storage.from('resources').remove([filePath]);
          throw dbError;
        }
      }

      setUploadForm({
        title: '',
        category: categories.length > 0 ? categories[0].name : '',
        file: null,
        fileType: 'pdf',
        url: '',
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      setNotification({ type: 'success', message: 'Resource added successfully!' });
    } catch (error: unknown) {
      console.error('Error uploading resource:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add resource';
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resource Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleFileTypeChange('pdf')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  uploadForm.fileType === 'pdf'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <FileText className="h-5 w-5" />
                <span className="font-medium">PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleFileTypeChange('video')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  uploadForm.fileType === 'video'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Video className="h-5 w-5" />
                <span className="font-medium">Video</span>
              </button>
              <button
                type="button"
                onClick={() => handleFileTypeChange('link')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  uploadForm.fileType === 'link'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Link className="h-5 w-5" />
                <span className="font-medium">Link</span>
              </button>
            </div>
          </div>
          {uploadForm.fileType === 'link' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={uploadForm.url}
                onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the full URL including https://
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {uploadForm.fileType === 'pdf' ? 'PDF File (Max 10MB)' : 'Video File (Max 100MB)'}
              </label>
              <input
                type="file"
                accept={uploadForm.fileType === 'pdf' ? '.pdf' : '.mp4,.webm,.mov,.avi,.wmv'}
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                required
              />
              {uploadForm.fileType === 'video' && (
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: MP4, WebM, MOV, AVI, WMV
                </p>
              )}
            </div>
          )}
          {uploadError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {uploadError}
            </div>
          )}
          <button
            type="submit"
            disabled={
              uploading ||
              !uploadForm.title.trim() ||
              !uploadForm.category ||
              (uploadForm.fileType === 'link' ? !uploadForm.url.trim() : !uploadForm.file)
            }
            className="w-full bg-rose-600 text-white py-2 px-4 rounded-lg hover:bg-rose-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                {uploadForm.fileType === 'link' ? 'Adding...' : 'Uploading...'}
              </>
            ) : (
              <>
                {uploadForm.fileType === 'link' ? <Link className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                {uploadForm.fileType === 'link' ? 'Add Link' : 'Upload Resource'}
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
