import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, NoteDetail } from '../types';
import { slugify } from '../lib/slug';
import { serializeNoteContent } from '../lib/frontmatter';
import { MarkdownViewer } from './MarkdownViewer';
import { AlertTriangle, RefreshCw, Edit3, Columns, Eye, LayoutTemplate, Sparkles, X, Check, Trash2, Globe } from 'lucide-react';
import { NOTE_TEMPLATES, NoteTemplate } from '../lib/templates';

interface NoteEditorProps {
  config: AppConfig;
  currentNote: NoteDetail | null;
  onSaveNote: (path: string, rawContent: string, existingSha?: string, isNew?: boolean) => Promise<void>;
  onAppendToDaily: (text: string) => Promise<void>;
  onDeleteNote: (path: string, sha?: string) => Promise<void>;
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
  const [isPublic, setIsPublic] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState<'replace' | 'append'>('replace');
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate>(NOTE_TEMPLATES[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync editor fields whenever selected note changes
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title || '');
      setTagsInput(currentNote.tags ? currentNote.tags.join(', ') : '');
      setContent(currentNote.content || '');
      setIsPublic(currentNote.isPublic || false);
    } else {
      // New note default state
      setTitle('');
      setTagsInput('');
      setContent('');
      setIsPublic(false);
    }
    setShowDeleteConfirm(false);
  }, [currentNote]);

  const handleApplyTemplate = (tpl: NoteTemplate) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const generatedContent = tpl.getContent(todayStr);

    if (templateMode === 'replace' || !content.trim()) {
      if (!title.trim() || templateMode === 'replace') {
        const defaultTitleFormatted = tpl.id === 'daily_journal'
          ? `${tpl.defaultTitle} - ${todayStr}`
          : tpl.defaultTitle;
        setTitle(defaultTitleFormatted);
      }

      if (!tagsInput.trim() || templateMode === 'replace') {
        setTagsInput(tpl.defaultTags.join(', '));
      } else {
        const existingTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        const merged = Array.from(new Set([...existingTags, ...tpl.defaultTags]));
        setTagsInput(merged.join(', '));
      }

      setContent(generatedContent);
    } else {
      // Append mode
      setContent(prev => (prev ? `${prev}\n\n${generatedContent}` : generatedContent));

      const existingTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const merged = Array.from(new Set([...existingTags, ...tpl.defaultTags]));
      setTagsInput(merged.join(', '));
    }

    setIsTemplateModalOpen(false);
    setToastMessage(`Applied "${tpl.name}" template!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

    const rawMarkdown = serializeNoteContent(title, tagsArray, content, isPublic);
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
    if (isLoading) return;
    if (currentNote && currentNote.path) {
      await onDeleteNote(currentNote.path, currentNote.sha);
    } else {
      onNewNote();
    }
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

          <div className="flex items-center gap-2">
            {onBackToList && (
              <button
                type="button"
                onClick={onBackToList}
                className="md:hidden text-xs text-blue-600 dark:text-blue-400 hover:underline mr-1 font-medium"
              >
                ← Notes List
              </button>
            )}

            {/* Template Selector Button */}
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors shadow-2xs"
              title="Insert note boilerplate template"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Templates</span>
            </button>

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

        {/* Tags Input + Publish Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (comma separated, e.g. work, ideas)..."
            className="flex-1 px-3.5 py-2 text-xs font-sans bg-gray-50/70 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => setIsPublic(v => !v)}
            title="Publish this note to the public digital garden"
            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-md border transition-colors shadow-2xs ${
              isPublic
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                : 'bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{isPublic ? 'Public' : 'Private'}</span>
          </button>
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
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{currentNote?.path ? "Delete Note" : "Discard Draft"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span>{currentNote?.path ? 'Delete Note?' : 'Discard Draft?'}</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
              {currentNote?.path ? (
                <>
                  Are you sure you want to delete <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{targetPath}</span>?
                  This will create a real <code className="font-mono bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1 py-0.5 rounded">DELETE</code> commit on your GitHub repository.
                </>
              ) : (
                <>
                  Are you sure you want to discard this unsaved note draft?
                </>
              )}
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
                {isLoading ? 'Processing...' : (currentNote?.path ? 'Confirm Delete' : 'Confirm Discard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-emerald-700 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Note Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90dvh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-slate-50/60 dark:bg-gray-800/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <LayoutTemplate className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Note Boilerplate Templates</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Select a pre-formatted template to jumpstart your note</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Insertion Mode Toggle Bar */}
            <div className="px-5 py-2.5 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                Application Mode:
              </span>

              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                <button
                  type="button"
                  onClick={() => setTemplateMode('replace')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    templateMode === 'replace'
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Replace Note Content
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateMode('append')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    templateMode === 'append'
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Append to Bottom
                </button>
              </div>
            </div>

            {/* Modal Content Grid.
                On mobile the modal body is the only scroller: the list and the
                preview get their own scroll boxes from md up, because nested
                scroll areas on a phone leave the template cards half-clipped. */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
              {/* Template Selection List (5 cols) */}
              <div className="md:col-span-5 space-y-2 md:max-h-[380px] md:overflow-y-auto md:pr-1">
                {NOTE_TEMPLATES.map(tpl => {
                  const isSelected = selectedTemplate.id === tpl.id;

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedTemplate(tpl);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl shrink-0 leading-none pt-0.5">{tpl.icon}</span>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{tpl.name}</h4>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">{tpl.description}</p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {tpl.defaultTags.map(t => (
                            <span key={t} className="text-[9px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1 py-0.2 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Template Preview Pane (7 cols). Capped on mobile so it cannot
                  push the template cards off the screen. */}
              <div className="md:col-span-7 flex flex-col bg-slate-50 dark:bg-gray-950/80 border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-56 md:max-h-[380px]">
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 min-w-0">
                    <span className="shrink-0">{selectedTemplate.icon}</span>
                    <span className="truncate">{selectedTemplate.name} Preview</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 shrink-0 hidden sm:inline">Markdown Format</span>
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-[11px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded border border-gray-200/80 dark:border-gray-800 leading-relaxed select-text">
                  {selectedTemplate.getContent(new Date().toISOString().split('T')[0])}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50 dark:bg-gray-800/40">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                Mode: <strong className="text-gray-700 dark:text-gray-200 capitalize">{templateMode}</strong>
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(selectedTemplate)}
                  className="flex-1 sm:flex-none min-w-0 px-4 py-2 sm:py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-md shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                  <span className="truncate">
                    Apply "{selectedTemplate.name}"<span className="hidden sm:inline"> Template</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

