import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ZoomIn, ZoomOut, Maximize, Download,
  Highlighter, Pencil, StickyNote, MoveRight,
  Eraser, Palette, Undo2, Redo2, Trash2,
  RefreshCw, AlertCircle, FileDown, Save,
  History, Clock, User, ChevronRight, Loader2
} from 'lucide-react';
import { AnnotationCanvas, Annotation, AnnotationTool } from './AnnotationCanvas';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  storagePath?: string;
}

type FileCategory = 'image' | 'pdf' | 'text' | 'spreadsheet' | 'unsupported';

interface DocumentVersion {
  id: string;
  document_path: string;
  file_url: string | null;
  saved_by_id: string;
  saved_by_name: string;
  saved_at: string;
  annotations_snapshot: Annotation[];
  changes_summary: string;
  version_number: number;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const TEXT_EXTENSIONS = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml', 'yml', 'yaml', 'py', 'rb', 'sh', 'sql', 'log', 'env'];
const SPREADSHEET_EXTENSIONS = ['xlsx', 'xls', 'csv'];
const ANNOTATION_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000'];

function getFileCategory(fileName: string, fileType?: string): FileCategory {
  if (fileType) {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType === 'application/pdf') return 'pdf';
    if (fileType.startsWith('text/') || fileType === 'application/json') return 'text';
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType === 'text/csv') return 'spreadsheet';
  }
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'pdf';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  if (SPREADSHEET_EXTENSIONS.includes(ext)) return 'spreadsheet';
  if (!ext || ext === fileName.toLowerCase()) return 'pdf';
  return 'unsupported';
}

export function DocumentPreview({ isOpen, onClose, fileUrl, fileName, fileType, storagePath }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('none');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [savedAnnotations, setSavedAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [spreadsheetHtml, setSpreadsheetHtml] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [viewingVersion, setViewingVersion] = useState<DocumentVersion | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [contentDims, setContentDims] = useState({ width: 0, height: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const documentWrapperRef = useRef<HTMLDivElement>(null);

  const category = getFileCategory(fileName, fileType);
  const documentPath = storagePath || fileName;
  const hasUnsavedChanges = JSON.stringify(annotations) !== JSON.stringify(savedAnnotations);

  // Measure document wrapper dimensions so the annotation canvas
  // matches exactly and scrolls in sync with the document content
  useEffect(() => {
    const wrapper = documentWrapperRef.current;
    if (!wrapper) return;
    const measure = () => {
      const w = wrapper.scrollWidth;
      const h = wrapper.scrollHeight;
      setContentDims(prev => (prev.width === w && prev.height === h) ? prev : { width: w, height: h });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    const interval = setInterval(measure, 300);
    return () => { observer.disconnect(); clearInterval(interval); };
  }, [isOpen, loadingContent, blobUrl, textContent, spreadsheetHtml]);

  useEffect(() => {
    if (!isOpen) return;
    setZoom(1);
    setActiveTool('none');
    setAnnotations([]);
    setSavedAnnotations([]);
    setUndoStack([]);
    setRedoStack([]);
    setTextContent(null);
    setSpreadsheetHtml(null);
    setLoadError(null);
    setRetryCount(0);
    setShowVersionHistory(false);
    setViewingVersion(null);
    setVersions([]);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    if (fileUrl) {
      setLoadingContent(true);
    }
  }, [isOpen, fileUrl]);

  // Load saved annotations from Supabase
  useEffect(() => {
    if (!isOpen || !documentPath) return;
    loadAnnotations();
  }, [isOpen, documentPath]);

  const loadAnnotations = async () => {
    const { data } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_path', documentPath)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      const loaded: Annotation[] = data.map(row => ({
        id: row.id,
        type: row.type as Annotation['type'],
        color: row.color,
        coordinates: row.coordinates as Annotation['coordinates'],
        points: row.points as Annotation['points'],
        startX: (row.coordinates as any)?.startX,
        startY: (row.coordinates as any)?.startY,
        endX: (row.coordinates as any)?.endX,
        endY: (row.coordinates as any)?.endY,
        content: row.content || undefined,
        author: { id: row.author_id, name: row.author_name },
        createdAt: row.created_at,
        pageNumber: row.page_number || undefined,
        textAnchor: row.text_anchor as Annotation['textAnchor'],
      }));
      setAnnotations(loaded);
      setSavedAnnotations(loaded);
    }
  };

  const fetchContent = useCallback(async () => {
    if (!fileUrl) return;
    setLoadingContent(true);
    setLoadError(null);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }

    try {
      if (category === 'pdf' || category === 'image') {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const blob = await res.blob();
        const mimeType = category === 'pdf' ? 'application/pdf'
          : (blob.type.startsWith('image/') ? blob.type : 'image/png');
        const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
        const url = URL.createObjectURL(typedBlob);
        setBlobUrl(url);
      } else if (category === 'text') {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const text = await res.text();
        setTextContent(text);
      } else if (category === 'spreadsheet') {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const buf = await res.arrayBuffer();
        const workbook = XLSX.read(buf, { type: 'array' });
        const html = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const table = XLSX.utils.sheet_to_html(sheet, { editable: false });
          return `<div class="mb-6"><h3 class="text-sm font-semibold text-gray-700 mb-2 px-2">${name}</h3>${table}</div>`;
        }).join('');
        setSpreadsheetHtml(html);
      }
    } catch {
      setLoadError('failed');
      setBlobUrl(null);
    } finally {
      setLoadingContent(false);
    }
  }, [fileUrl, category]);

  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    fetchContent();
  }, [isOpen, fileUrl, category]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchContent();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.key === 's') { e.preventDefault(); handleSave(); }
    }
  }, [onClose, annotations]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const pushAnnotationState = useCallback(() => {
    setUndoStack(prev => [...prev, annotations]);
    setRedoStack([]);
  }, [annotations]);

  const handleAnnotationAdd = useCallback((annotation: Annotation) => {
    pushAnnotationState();
    setAnnotations(prev => [...prev, annotation]);
  }, [pushAnnotationState]);

  const handleAnnotationErase = useCallback((id: string) => {
    pushAnnotationState();
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, [pushAnnotationState]);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const newUndo = [...prev];
      const lastState = newUndo.pop()!;
      setRedoStack(redo => [...redo, annotations]);
      setAnnotations(lastState);
      return newUndo;
    });
  }, [annotations]);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const newRedo = [...prev];
      const nextState = newRedo.pop()!;
      setUndoStack(undo => [...undo, annotations]);
      setAnnotations(nextState);
      return newRedo;
    });
  }, [annotations]);

  const handleClearAll = useCallback(() => {
    if (annotations.length === 0) return;
    pushAnnotationState();
    setAnnotations([]);
  }, [annotations, pushAnnotationState]);

  const handleSave = async () => {
    if (saving || !hasUnsavedChanges) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('sales_people')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle();

      const authorName = profile?.name || user.email || 'Unknown';

      // Determine what changed
      const added = annotations.filter(a => !savedAnnotations.find(s => s.id === a.id));
      const removed = savedAnnotations.filter(s => !annotations.find(a => a.id === s.id));
      const changeParts: string[] = [];
      if (added.length > 0) changeParts.push(`Added ${added.length} annotation${added.length > 1 ? 's' : ''}`);
      if (removed.length > 0) changeParts.push(`Removed ${removed.length} annotation${removed.length > 1 ? 's' : ''}`);
      const changesSummary = changeParts.join(', ') || 'Updated annotations';

      // Get current version number
      const { data: latestVersion } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_path', documentPath)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latestVersion?.version_number || 0) + 1;

      // Save version record
      await supabase.from('document_versions').insert({
        document_path: documentPath,
        file_url: fileUrl,
        saved_by_id: user.id,
        saved_by_name: authorName,
        annotations_snapshot: annotations as any,
        changes_summary: changesSummary,
        version_number: nextVersion,
      });

      // Delete existing annotations for this document by this user, then re-insert all
      await supabase
        .from('document_annotations')
        .delete()
        .eq('document_path', documentPath)
        .eq('author_id', user.id);

      // Insert current user's annotations
      const userAnnotations = annotations.filter(a => !a.author || a.author.id === user.id);
      const otherAnnotations = annotations.filter(a => a.author && a.author.id !== user.id);

      if (userAnnotations.length > 0) {
        const rows = userAnnotations.map(a => ({
          id: a.id,
          document_path: documentPath,
          type: a.type === 'draw' ? 'drawing' : a.type === 'text' ? 'text-note' : a.type,
          coordinates: a.type === 'arrow'
            ? { startX: a.startX, startY: a.startY, endX: a.endX, endY: a.endY }
            : (a.coordinates || {}),
          points: a.points || null,
          content: a.content || null,
          color: a.color,
          author_id: user.id,
          author_name: authorName,
          page_number: a.pageNumber || null,
          text_anchor: a.textAnchor || null,
        }));

        await supabase.from('document_annotations').insert(rows);
      }

      // Update saved state
      const allAnnotations = [...otherAnnotations, ...userAnnotations.map(a => ({
        ...a,
        author: { id: user.id, name: authorName },
      }))];
      setSavedAnnotations(allAnnotations);
      setAnnotations(allAnnotations);
    } catch (err) {
      console.error('Failed to save annotations:', err);
    } finally {
      setSaving(false);
    }
  };

  const loadVersionHistory = async () => {
    setLoadingVersions(true);
    const { data } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_path', documentPath)
      .order('version_number', { ascending: false });

    if (data) {
      setVersions(data as DocumentVersion[]);
    }
    setLoadingVersions(false);
  };

  const handleToggleVersionHistory = () => {
    if (!showVersionHistory) loadVersionHistory();
    setShowVersionHistory(!showVersionHistory);
  };

  const handleViewVersion = (version: DocumentVersion) => {
    setViewingVersion(version);
    setAnnotations(version.annotations_snapshot || []);
  };

  const handleExitVersionView = () => {
    setViewingVersion(null);
    loadAnnotations();
  };

  const getDownloadFileName = (): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const knownExtensions = [...IMAGE_EXTENSIONS, 'pdf', 'doc', 'docx', ...TEXT_EXTENSIONS, ...SPREADSHEET_EXTENSIONS];
    if (knownExtensions.includes(ext)) return fileName;
    const mimeToExt: Record<string, string> = {
      'pdf': '.pdf', 'image': '.png', 'text': '.txt', 'spreadsheet': '.xlsx',
    };
    return fileName + (mimeToExt[category] || '.pdf');
  };

  const handleDownload = () => {
    const downloadUrl = blobUrl || fileUrl;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = getDownloadFileName();
    link.click();
  };

  if (!isOpen) return null;

  const toolButtons: { tool: AnnotationTool; icon: typeof Highlighter; label: string }[] = [
    { tool: 'highlight', icon: Highlighter, label: 'Highlight' },
    { tool: 'draw', icon: Pencil, label: 'Freehand Draw' },
    { tool: 'text', icon: StickyNote, label: 'Text Note' },
    { tool: 'arrow', icon: MoveRight, label: 'Arrow/Line' },
    { tool: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden" style={{ width: '90vw', height: '90vh' }}>
        {/* Version viewing banner */}
        {viewingVersion && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Viewing version {viewingVersion.version_number} by {viewingVersion.saved_by_name}
              </span>
              <span className="text-xs text-amber-600">
                {new Date(viewingVersion.saved_at).toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleExitVersionView}
              className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-md transition-colors"
            >
              Back to Current
            </button>
          </div>
        )}

        {/* Top Toolbar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-gray-900 text-white gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium truncate max-w-[200px]" title={fileName}>{fileName}</p>
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{category.toUpperCase()}</span>
            {hasUnsavedChanges && !viewingVersion && (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
            )}
          </div>

          {/* Annotation tools */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
            {toolButtons.map(({ tool, icon: Icon, label }) => (
              <button
                key={tool}
                onClick={() => setActiveTool(activeTool === tool ? 'none' : tool)}
                className={`p-1.5 rounded transition-colors ${activeTool === tool ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                title={label}
                disabled={!!viewingVersion}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                title="Color"
              >
                <Palette className="w-4 h-4" />
                <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-gray-600" style={{ backgroundColor: activeColor }} />
              </button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 flex gap-1 z-10">
                  {ANNOTATION_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => { setActiveColor(color); setShowColorPicker(false); }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${activeColor === color ? 'border-white scale-110' : 'border-gray-600'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <button onClick={handleUndo} disabled={undoStack.length === 0 || !!viewingVersion} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors" title="Undo">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={redoStack.length === 0 || !!viewingVersion} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors" title="Redo">
              <Redo2 className="w-4 h-4" />
            </button>
            <button onClick={handleClearAll} disabled={annotations.length === 0 || !!viewingVersion} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors" title="Clear All">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Save, History, Zoom, actions */}
          <div className="flex items-center gap-1">
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving || !!viewingVersion}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                hasUnsavedChanges && !viewingVersion
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
              title="Save annotations (Ctrl+S)"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </button>

            {/* Version History toggle */}
            <button
              onClick={handleToggleVersionHistory}
              className={`p-1.5 rounded transition-colors ${showVersionHistory ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              title="Version History"
            >
              <History className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(1)} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors" title="Reset Zoom">
              <Maximize className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <button onClick={handleDownload} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors" title="Download">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ml-1" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main content area with optional version sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document viewer — this is the scroll container */}
          <div className="flex-1 overflow-auto bg-gray-100" ref={contentRef}>
            {/*
              The inner wrapper uses transform:scale for zoom. Both the document
              content and the annotation canvas are children of this wrapper,
              so they share the same coordinate space and scroll together.
              position:relative establishes the positioning context for the
              absolutely-positioned canvas overlay.
            */}
            <div
              ref={documentWrapperRef}
              className="relative inline-block min-w-full min-h-full"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            >
              <DocumentContent
                category={category}
                fileUrl={fileUrl}
                blobUrl={blobUrl}
                fileName={fileName}
                textContent={textContent}
                spreadsheetHtml={spreadsheetHtml}
                loading={loadingContent}
                error={loadError}
                retryCount={retryCount}
                onRetry={handleRetry}
                onDownload={handleDownload}
              />

              {/* Annotation canvas overlay — positioned absolute within the
                  document wrapper so it scrolls with the document content.
                  Dimensions are explicitly passed from the measured wrapper size
                  so buffer and CSS sizes always match. */}
              <AnnotationCanvas
                activeTool={viewingVersion ? 'none' : activeTool}
                activeColor={activeColor}
                annotations={annotations}
                onAnnotationAdd={handleAnnotationAdd}
                onAnnotationErase={handleAnnotationErase}
                containerWidth={contentDims.width}
                containerHeight={contentDims.height}
              />
            </div>
          </div>

          {/* Version History Sidebar */}
          {showVersionHistory && (
            <div className="w-72 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-500" />
                  Version History
                </h3>
              </div>
              {loadingVersions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : versions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-500">No saved versions yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Annotations will appear here once saved.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {versions.map(version => (
                    <button
                      key={version.id}
                      onClick={() => handleViewVersion(version)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors group ${
                        viewingVersion?.id === version.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          v{version.version_number}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600 truncate">{version.saved_by_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {new Date(version.saved_at).toLocaleDateString()} {new Date(version.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {version.changes_summary && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{version.changes_summary}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DocumentContentProps {
  category: FileCategory;
  fileUrl: string;
  blobUrl: string | null;
  fileName: string;
  textContent: string | null;
  spreadsheetHtml: string | null;
  loading: boolean;
  error: string | null;
  retryCount: number;
  onRetry: () => void;
  onDownload: () => void;
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-[80vh] gap-4">
      <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      <p className="text-sm text-gray-600 font-medium">Loading document...</p>
    </div>
  );
}

function ErrorState({ retryCount, onRetry, onDownload }: { retryCount: number; onRetry: () => void; onDownload: () => void }) {
  const showDownloadFallback = retryCount >= 2;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-5 px-6">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <div className="text-center max-w-sm">
        <p className="text-lg font-semibold text-gray-800 mb-1">
          {showDownloadFallback ? "This file couldn't be previewed" : "We couldn't load this file"}
        </p>
        <p className="text-sm text-gray-500">
          {showDownloadFallback
            ? "The preview isn't available right now. You can download the file to view it on your computer."
            : "This sometimes happens with large files or slow connections. Please try again."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        {showDownloadFallback && (
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Download File
          </button>
        )}
      </div>
      {retryCount > 0 && retryCount < 2 && (
        <p className="text-xs text-gray-400">Attempt {retryCount + 1}</p>
      )}
    </div>
  );
}

function DocumentContent({ category, fileUrl, blobUrl, fileName, textContent, spreadsheetHtml, loading, error, retryCount, onRetry, onDownload }: DocumentContentProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState retryCount={retryCount} onRetry={onRetry} onDownload={onDownload} />;
  }

  switch (category) {
    case 'image':
      return (
        <div className="flex items-center justify-center p-8 min-h-[80vh]">
          {blobUrl ? (
            <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain shadow-lg rounded" />
          ) : (
            <ErrorState retryCount={retryCount} onRetry={onRetry} onDownload={onDownload} />
          )}
        </div>
      );

    case 'pdf':
      return blobUrl ? (
        <iframe
          src={blobUrl}
          title={fileName}
          className="w-full border-0"
          style={{ height: '85vh' }}
        />
      ) : (
        <ErrorState retryCount={retryCount} onRetry={onRetry} onDownload={onDownload} />
      );

    case 'text':
      return (
        <div className="p-6 min-h-[80vh]">
          <pre className="bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-800 font-mono whitespace-pre-wrap overflow-x-auto shadow-sm leading-relaxed">
            {textContent || ''}
          </pre>
        </div>
      );

    case 'spreadsheet':
      return (
        <div className="p-6 min-h-[80vh]">
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto spreadsheet-preview"
            dangerouslySetInnerHTML={{ __html: spreadsheetHtml || '' }}
          />
        </div>
      );

    case 'unsupported':
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
            <X className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-700">Preview not available</p>
          <p className="text-sm text-gray-500">This file type cannot be previewed in the browser.</p>
          <button
            onClick={onDownload}
            className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download File
          </button>
        </div>
      );
  }
}
