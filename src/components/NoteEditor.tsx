import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, NoteDetail } from '../types';
import { slugify } from '../lib/slug';
import { serializeNoteContent } from '../lib/frontmatter';
import { MarkdownViewer } from './MarkdownViewer';
import { AlertTriangle, RefreshCw, Edit3, Columns, Eye } from 'lucide-react';

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

  // Keyboard shortcut listener
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
    setContent('');
  };

  const handleDelete = async () => {
    if (!currentNote || !currentNote.sha || isLoading) return;
    await onDeleteNote(currentNote.path, currentNote.sha);
    setShowDeleteConfirm(false);
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-[#f0f3f7] dark:bg-gray-950 p-3 sm:p-5 overflow-y-auto transition-colors">
      {/* Conflict Alert Banner */}
      {conflictError && (
        <div className="bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 p-3 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 mb-4 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">409 SHA Conflict: </span>
              <span>This note was modified on GitHub by another commit. Re-fetch to merge changes.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onResolveConflictRefresh}
            className="inline-flex items-center gap-1 bg-amber-800 dark:bg-amber-700 text-white px-2.5 py-1 rounded font-medium hover:bg-amber-900 dark:hover:bg-amber-600 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Re-fetch Latest
          </button>
        </div>
      )}

      {/* Main White/Dark Card Layout */}
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-2xs flex-1 flex flex-col gap-3 min-h-[500px] transition-colors">
        {/* Card Header: Target Path & View Toggle */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
          <div className="font-mono text-xs flex items-center gap-1.5 truncate">
            <span className="text-gray-700 dark:text-gray-300 font-semibold">Target Path:</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold truncate">{targetPath}</span>
          </div>

          <div className="flex items-center gap-1">
            {onBackToList && (
              <button
                type="button"
                onClick={onBackToList}
                className="md:hidden text-xs text-blue-600 dark:text-blue-400 hover:underline mr-2 font-medium"
              >
                ← Notes List
              </button>
            )}

            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`p-1 rounded text-xs transition-colors ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Edit mode"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`p-1 rounded text-xs hidden sm:block transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Side-by-side preview"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`p-1 rounded text-xs transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Preview mode"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Note Title Input */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note Title..."
            className="w-full px-3.5 py-2 text-xs font-sans bg-gray-50/70 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
        </div>

        {/* Tags Input */}
        <div>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (comma separated, e.g. work, ideas)..."
            className="w-full px-3.5 py-2 text-xs font-sans bg-gray-50/70 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
        </div>

        {/* Markdown Content Area */}
        <div className="flex-1 flex overflow-hidden min-h-[280px]">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`flex-1 flex flex-col ${viewMode === 'split' ? 'border-r border-gray-200 dark:border-gray-800 pr-2' : ''}`}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your markdown note content here..."
                spellCheck={false}
                className="w-full h-full p-3.5 font-mono text-xs text-gray-900 dark:text-gray-100 bg-[#edf1f5] dark:bg-gray-950/90 border border-gray-300 dark:border-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              />
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="flex-1 overflow-y-auto pl-2 bg-gray-50/50 dark:bg-gray-950/50 rounded-md p-2 border border-gray-200 dark:border-gray-800">
              <MarkdownViewer content={content} />
            </div>
          )}
        </div>

        {/* Bottom Action Row */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className={`px-4 py-2 text-xs font-bold rounded-md text-white shadow-2xs transition-colors ${
                isLoading
                  ? 'bg-blue-400 dark:bg-blue-800/60 cursor-not-allowed'
                  : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 active:bg-blue-800'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save Note'}
            </button>

            <button
              type="button"
              onClick={handleAppendDaily}
              disabled={isLoading || !content.trim()}
              className={`px-4 py-2 text-xs font-semibold rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 shadow-2xs transition-colors ${
                isLoading || !content.trim()
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100'
              }`}
            >
              Append to Today
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading || !currentNote?.sha}
              className={`px-4 py-2 text-xs font-semibold rounded-md border transition-colors ${
                !currentNote?.sha
                  ? 'text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
                  : 'text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30'
              }`}
            >
              Delete Note
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400">Delete Note?</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
              Are you sure you want to delete <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{currentNote?.path}</span>?
              This will create a real <code className="font-mono bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1 py-0.5 rounded">DELETE</code> commit on GitHub.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-500 rounded-md shadow-2xs transition-colors"
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

