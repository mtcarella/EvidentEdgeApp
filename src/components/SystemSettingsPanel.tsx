import { useState, useEffect } from 'react';
import { Save, RotateCcw, Clock, Bold, Italic, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

const DEFAULT_NO_RESULTS_MESSAGE =
  'Great! You\'ve Found a New Prospect!\n\nThis contact is **not** in our system yet. Please contact **Michele** to have them added to the system.\n\n*Great job on finding a new future client!*';

function renderFormattedMessage(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br />');

  return html;
}

export function SystemSettingsPanel() {
  const [noResultsMessage, setNoResultsMessage] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchSetting();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchSetting = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'conflict_search_no_results_message')
      .maybeSingle();

    if (error) {
      console.error('Error fetching setting:', error);
      setNoResultsMessage(DEFAULT_NO_RESULTS_MESSAGE);
      setOriginalValue(DEFAULT_NO_RESULTS_MESSAGE);
    } else if (data) {
      setNoResultsMessage(data.value);
      setOriginalValue(data.value);
      setUpdatedAt(data.updated_at);
    } else {
      setNoResultsMessage(DEFAULT_NO_RESULTS_MESSAGE);
      setOriginalValue(DEFAULT_NO_RESULTS_MESSAGE);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: 'conflict_search_no_results_message', value: noResultsMessage, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Error saving setting:', error);
      setNotification({ type: 'error', message: 'Failed to save setting' });
    } else {
      setOriginalValue(noResultsMessage);
      setUpdatedAt(new Date().toISOString());
      setNotification({ type: 'success', message: 'Setting saved successfully' });
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setNoResultsMessage(DEFAULT_NO_RESULTS_MESSAGE);
    setSaving(true);

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: 'conflict_search_no_results_message', value: DEFAULT_NO_RESULTS_MESSAGE, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Error resetting setting:', error);
      setNotification({ type: 'error', message: 'Failed to reset setting' });
    } else {
      setOriginalValue(DEFAULT_NO_RESULTS_MESSAGE);
      setUpdatedAt(new Date().toISOString());
      setNotification({ type: 'success', message: 'Setting reset to default' });
    }
    setSaving(false);
  };

  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = document.getElementById('no-results-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = noResultsMessage.slice(start, end);
    const newText = noResultsMessage.slice(0, start) + prefix + selectedText + suffix + noResultsMessage.slice(end);
    setNoResultsMessage(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = end + prefix.length;
    }, 0);
  };

  const hasChanges = noResultsMessage !== originalValue;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-2">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {notification.message}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Conflict Search - No Results Message</h3>
            <p className="text-sm text-gray-500 mt-1">
              This message is displayed to all users when a conflict search returns no matches.
            </p>
          </div>
          {updatedAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {new Date(updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-1 mb-2 border border-gray-200 rounded-t-lg px-2 py-1.5 bg-gray-50">
          <button
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-700"
            title="Bold (**text**)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-700"
            title="Italic (*text*)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${showPreview ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-600'}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        {/* Textarea */}
        <textarea
          id="no-results-textarea"
          value={noResultsMessage}
          onChange={(e) => setNoResultsMessage(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 border border-gray-200 border-t-0 rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
          placeholder="Enter the no results message..."
        />

        <p className="text-xs text-gray-400 mt-1.5">
          Use **text** for bold and *text* for italic. Use line breaks for paragraphs.
        </p>

        {/* Live Preview */}
        {showPreview && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview</span>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-b-lg text-center">
              <div
                className="text-green-800 text-lg leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderFormattedMessage(noResultsMessage) }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          {hasChanges && (
            <span className="text-xs text-amber-600 font-medium ml-2">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}
