import { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, Download, Loader, AlertCircle, ChevronDown, ChevronUp, Eye, X, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useDeviceDetection } from '../lib/deviceDetection';

interface Resource {
  id: string;
  title: string;
  category: string;
  file_path: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
  uploader?: {
    name: string;
  } | null;
}

type Category = 'Evident Edge Tutorials' | 'Accutitle Tutorials' | "FAQ's" | 'Office Resources' | 'Marketing' | 'Miscellaneous' | 'Administration';

const ALL_CATEGORIES: Category[] = ['Evident Edge Tutorials', 'Accutitle Tutorials', "FAQ's", 'Office Resources', 'Marketing', 'Miscellaneous', 'Administration'];
const PUBLIC_CATEGORIES: Category[] = ['Evident Edge Tutorials', 'Accutitle Tutorials', "FAQ's", 'Office Resources', 'Marketing', 'Miscellaneous'];

export function Resources() {
  const { salesPerson, isAdmin } = useAuth();
  const { isMobile } = useDeviceDetection();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Show all categories to admins, only public categories to regular users
  const visibleCategories = isAdmin ? ALL_CATEGORIES : PUBLIC_CATEGORIES;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(visibleCategories));
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editCategory, setEditCategory] = useState<Category>('Evident Edge Tutorials');
  const [editLoading, setEditLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState<{
    title: string;
    category: Category;
    file: File | null;
  }>({
    title: '',
    category: 'Evident Edge Tutorials',
    file: null,
  });

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('category')
        .order('title');

      if (error) throw error;

      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
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
    if (!uploadForm.file || !uploadForm.title.trim() || !salesPerson?.id) return;

    setUploading(true);
    setUploadError(null);

    try {
      const fileName = `${Date.now()}_${uploadForm.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${uploadForm.category}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resources')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

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
        category: 'Evident Edge Tutorials',
        file: null,
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await fetchResources();
    } catch (error: any) {
      console.error('Error uploading resource:', error);
      setUploadError(error.message || 'Failed to upload resource');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (resource: Resource) => {
    try {
      const { data, error } = await supabase.storage
        .from('resources')
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setPreviewResource(resource);
    } catch (error) {
      console.error('Error previewing resource:', error);
      alert('Failed to preview resource');
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewResource(null);
  };

  const handleDownload = async (resource: Resource) => {
    try {
      const { data, error } = await supabase.storage
        .from('resources')
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resource.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resource:', error);
      alert('Failed to download resource');
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!confirm(`Are you sure you want to delete "${resource.title}"?`)) return;

    try {
      const { error: dbError } = await supabase
        .from('resources')
        .delete()
        .eq('id', resource.id);

      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage
        .from('resources')
        .remove([resource.file_path]);

      if (storageError) console.error('Error deleting file from storage:', storageError);

      await fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      alert('Failed to delete resource');
    }
  };

  const handleEditClick = (resource: Resource) => {
    setEditingResource(resource);
    setEditCategory(resource.category as Category);
  };

  const handleEditCancel = () => {
    setEditingResource(null);
    setEditCategory('Evident Edge Tutorials');
  };

  const handleEditSave = async () => {
    if (!editingResource) return;

    // Only admins and super admins can change categories
    if (!isAdmin) {
      alert('You do not have permission to change resource categories.');
      return;
    }

    setEditLoading(true);

    try {
      const oldFilePath = editingResource.file_path;
      const oldCategory = editingResource.category;

      // If category changed, we need to move the file in storage
      if (oldCategory !== editCategory) {
        const fileName = oldFilePath.split('/').pop();
        const newFilePath = `${editCategory}/${fileName}`;

        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('resources')
          .download(oldFilePath);

        if (downloadError) {
          console.error('Download error:', downloadError);
          throw new Error(`Failed to download file: ${downloadError.message}`);
        }

        // Check if file exists at new location and remove it
        const { data: existingFiles } = await supabase.storage
          .from('resources')
          .list(editCategory);

        if (existingFiles?.some(file => file.name === fileName)) {
          await supabase.storage.from('resources').remove([newFilePath]);
        }

        // Upload to new location
        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(newFilePath, fileData);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Update database record
        const { error: updateError } = await supabase
          .from('resources')
          .update({
            category: editCategory,
            file_path: newFilePath,
          })
          .eq('id', editingResource.id);

        if (updateError) {
          console.error('Database update error:', updateError);
          // Rollback: delete the newly uploaded file
          await supabase.storage.from('resources').remove([newFilePath]);
          throw new Error(`Failed to update database: ${updateError.message}`);
        }

        // Delete old file from storage
        const { error: deleteError } = await supabase.storage
          .from('resources')
          .remove([oldFilePath]);

        if (deleteError) console.error('Error deleting old file from storage:', deleteError);
      }

      await fetchResources();
      handleEditCancel();
    } catch (error: any) {
      console.error('Error updating resource:', error);
      alert(error.message || 'Failed to update resource category');
    } finally {
      setEditLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const resourcesByCategory = visibleCategories.reduce((acc, category) => {
    acc[category] = resources.filter(r => r.category === category);
    return acc;
  }, {} as Record<Category, Resource[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Resources</h2>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5" />
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as Category })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {visibleCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              disabled={uploading || !uploadForm.file || !uploadForm.title.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      )}

      <div className="space-y-4">
        {visibleCategories.map(category => {
          const categoryResources = resourcesByCategory[category];
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
                  <span className="text-sm text-gray-500">
                    ({categoryResources.length})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200">
                  {categoryResources.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-500">
                      No resources in this category yet
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {categoryResources.map(resource => (
                        <div
                          key={resource.id}
                          className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{resource.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatFileSize(resource.file_size)} • {new Date(resource.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreview(resource)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="View PDF"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDownload(resource)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="h-5 w-5" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEditClick(resource)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Edit Category"
                                >
                                  <Edit className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(resource)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {previewResource && previewUrl && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 ${isMobile ? 'p-0' : 'p-4'}`}>
          <div className={`bg-white shadow-xl w-full flex flex-col ${isMobile ? 'h-full' : 'rounded-lg max-w-6xl h-[95vh]'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'p-3' : 'p-4'}`}>
              <h3 className={`font-semibold text-gray-900 truncate mr-2 ${isMobile ? 'text-sm' : 'text-lg'}`}>
                {previewResource.title}
              </h3>
              <button
                onClick={closePreview}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title="Close"
              >
                <X className={isMobile ? 'h-5 w-5' : 'h-6 w-6'} />
              </button>
            </div>
            <div className="flex-1 overflow-auto -webkit-overflow-scrolling-touch">
              {isMobile ? (
                <iframe
                  src={`${previewUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full border-0"
                  title={previewResource.title}
                  style={{ minHeight: '100%' }}
                />
              ) : (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-full min-h-[600px]"
                  title={previewResource.title}
                >
                  <iframe
                    src={previewUrl}
                    className="w-full h-full min-h-[600px]"
                    title={previewResource.title}
                  />
                </object>
              )}
            </div>
          </div>
        </div>
      )}

      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Resource Category
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resource
                </label>
                <p className="text-gray-900 font-medium">{editingResource.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Category
                </label>
                <p className="text-gray-600">{editingResource.category}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as Category)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {visibleCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditCancel}
                disabled={editLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading || editCategory === editingResource.category}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {editLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
