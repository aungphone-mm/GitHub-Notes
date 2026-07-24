import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, NoteDetail } from '../types';
import { slugify } from '../lib/slug';
import { serializeNoteContent } from '../lib/frontmatter';
import { MarkdownViewer } from './MarkdownViewer';
import { Save, PlusCircle, Trash2, Eye, Edit3, Columns, Calendar, Tag, FileCode, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface NoteEditorProps {
  config: AppConfig;
  currentNote: NoteDetail | null;
  onSaveNote: (path: string, rawContent: string, existingSha?: string, isNew?: boolean) => Promise<void>;
  onAppendToDaily: (text: string) => Promise<void>;
  onDeleteNote: (path: string, sha: string) => Promise<void>;
  onNewNote: () => void;
  isLoading: boolean;
  conflictError: string | null;
  onResolveConflictRefresh: () => void;
  onBackToList?: () => void;
}

type ViewMode = 'edit' | 'split' | 'preview';

export const NoteEditor: React.FC<NoteEditorProps> = ({
  config,
  currentNote,
  onSaveNote,
  onAppendToDaily,
  onDeleteNote,
  onNewNote,
  isLoading,
  conflictError,
  onResolveConflictRefresh,
  onBackToList
}) => {
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync editor fields whenever selected note changes
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title || '');
      setTagsInput(currentNote.tags ? currentNote.tags.join(', ') : '');
      setContent(currentNote.content || '');
    } else {
      // New note default state
      setTitle('');
      setTagsInput('');
      setContent('');
    }
    setShowDeleteConfirm(false);
  }, [currentNote]);

  // Compute live target path
  const targetPath = useMemo(() => {
    if (currentNote && currentNote.path) {
      return currentNote.path;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const slug = slugify(title);
    let folderPrefix = (config.notesFolder || 'notes').trim().replace(/^\/+|\/+$/g, '');

    if (!folderPrefix) {
      return `${year}/${todayStr}-${slug}.md`;
    }
    return `${folderPrefix}/${year}/${todayStr}-${slug}.md`;
  }, [currentNote, title, config.notesFolder]);

  // Keyboard shortcut listener (Ctrl/Cmd+S for save, Ctrl/Cmd+Enter for new)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onNewNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, tagsInput, content, currentNote, targetPath, isLoading]);

  const handleSave = async () => {
    if (isLoading) return;

    const tagsArray = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Build raw markdown with YAML frontmatter
    const rawMarkdown = serializeNoteContent(title, tagsArray, content);
    const isNew = !currentNote || !currentNote.sha;

    await onSaveNote(
      targetPath,
      rawMarkdown,
      currentNote?.sha,
      isNew
    );
  };

  const handleAppendDaily = async () => {
    if (isLoading || !content.trim()) return;
    await onAppendToDaily(content);
    setContent(''); // Clear textarea on successful daily log append
  };

  const handleDelete = async () => {
    if (!currentNote || !currentNote.sha || isLoading) return;
    await onDeleteNote(currentNote.path, currentNote.sha);
    setShowDeleteConfirm(false);
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-[#f2f4f7] overflow-hidden">
      {/* Conflict Alert Banner */}
      {conflictError && (
        <div className="bg-amber-100 border-b border-amber-300 p-3 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold">409 SHA Conflict: </span>
              <span>This note was modified on GitHub by another commit. Re-fetch to merge changes.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onResolveConflictRefresh}
            className="inline-flex items-center gap-1 bg-amber-800 text-white px-2.5 py-1 rounded font-medium hover:bg-amber-900 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Re-fetch Latest
          </button>
        </div>
      )}

      {/* Editor Header Bar */}
      <div className="p-2.5 sm:p-3 bg-white border-b border-gray-200 shadow-2xs flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {onBackToList && (
              <button
                type="button"
                onClick={onBackToList}
                className="md:hidden inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors border border-gray-200"
                title="Back to Notes List"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Notes</span>
              </button>
            )}

            {/* Note Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title (Supports Burmese script & Emoji)..."
              className="flex-1 text-base sm:text-base font-bold text-gray-900 font-sans-myanmar bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none px-1 py-0.5 transition-colors min-w-0"
            />
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-md border border-gray-200 text-gray-600">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  viewMode === 'edit' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-gray-900'
                }`}
                title="Edit mode"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`p-1.5 rounded text-xs hidden sm:flex items-center gap-1 ${
                  viewMode === 'split' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-gray-900'
                }`}
                title="Side-by-side preview"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  viewMode === 'preview' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-gray-900'
                }`}
                title="Preview mode"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Save Note Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-md shadow-2xs transition-all ${
                isLoading
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              }`}
              title="Commit note to GitHub (Ctrl+S / Cmd+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Saving...' : 'Save'}</span>
            </button>

            {/* Append to Today Button */}
            <button
              type="button"
              onClick={handleAppendDaily}
              disabled={isLoading || !content.trim()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border shadow-2xs transition-all ${
                isLoading || !content.trim()
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 active:scale-[0.98]'
              }`}
              title="Append editor text to notes/daily/YYYY-MM-DD.md"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Append to Today</span>
            </button>

            {/* Delete Button (if existing file) */}
            {currentNote && currentNote.sha && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md border border-transparent hover:border-red-200 transition-colors"
                title="Delete note from GitHub"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Metadata Inputs Row: Tags & Target Path */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
          {/* Tags Input */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tags (comma-separated, e.g. work, ideas)"
              className="px-2 py-1 sm:py-0.5 text-sm sm:text-xs bg-gray-50 border border-gray-200 rounded font-mono text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>

          {/* Target Path Display */}
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600 bg-gray-100/80 px-2 py-0.5 rounded border border-gray-200 max-w-full truncate">
            <FileCode className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="text-gray-400 shrink-0">Target:</span>
            <span className="font-bold text-gray-800 truncate">{targetPath}</span>
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Textarea */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex-1 flex flex-col bg-white ${viewMode === 'split' ? 'border-r border-gray-200' : ''}`}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your markdown note here... (Supports Burmese text, Emoji, and standard Markdown syntax)"
              spellCheck={false}
              className="w-full h-full p-4 font-mono-myanmar text-xs text-gray-900 bg-white focus:outline-none resize-none leading-relaxed"
            />
          </div>
        )}

        {/* Markdown Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 overflow-y-auto bg-gray-50/50 p-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-2xs min-h-full">
              <MarkdownViewer content={content} />
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-bold">Delete Note?</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              Are you sure you want to delete <span className="font-mono font-bold text-gray-900">{currentNote?.path}</span>?
              This will create a real <code className="font-mono bg-red-50 text-red-700 px-1 py-0.5 rounded">DELETE</code> commit on GitHub.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-2xs"
              >
                {isLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
