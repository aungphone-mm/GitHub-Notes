import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppConfig, NoteDetail } from '../types';
import { slugify } from '../lib/slug';
import { serializeNoteContent } from '../lib/frontmatter';
import { MarkdownViewer } from './MarkdownViewer';
import { AlertTriangle, RefreshCw, Edit3, Columns, Eye, LayoutTemplate, Sparkles, X, Check, Trash2, Tag, FileText, AlignLeft, Loader2 } from 'lucide-react';
import { NOTE_TEMPLATES, NoteTemplate } from '../lib/templates';
import { suggestTags, generateTitle, summarizeNote } from '../lib/geminiApi';

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
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState<'replace' | 'append'>('replace');
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate>(NOTE_TEMPLATES[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // AI state
  const [aiLoadingTag, setAiLoadingTag] = useState(false);
  const [aiLoadingTitle, setAiLoadingTitle] = useState(false);
  const [aiLoadingSummary, setAiLoadingSummary] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);

  // Word count & read time
  const wordStats = useMemo(() => {
    const text = content.trim();
    if (!text) return { words: 0, chars: 0, readTime: 0 };
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const readTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTime };
  }, [content]);

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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // ── AI Handlers ────────────────────────────────────────────────────────────
  // Routes through the proxy worker when configured, else calls Gemini directly.
  const aiSettings = useMemo(() => ({
    proxyUrl: config.aiProxyUrl,
    proxyKey: config.aiProxyKey,
    geminiKey: config.geminiKey
  }), [config.aiProxyUrl, config.aiProxyKey, config.geminiKey]);

  const handleAISuggestTags = useCallback(async () => {
    if (aiLoadingTag || (!content.trim() && !title.trim())) return;
    setAiLoadingTag(true);
    setAiError(null);
    try {
      const tags = await suggestTags(title, content, aiSettings);
      if (tags.length === 0) { setAiError('No tag suggestions returned.'); return; }
      const existing = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...tags]));
      setTagsInput(merged.join(', '));
      showToast(`✨ Added ${tags.length} AI tag${tags.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      setAiError(err?.message || 'Failed to suggest tags.');
    } finally {
      setAiLoadingTag(false);
    }
  }, [title, content, tagsInput, aiSettings, aiLoadingTag, showToast]);

  const handleAIGenerateTitle = useCallback(async () => {
    if (aiLoadingTitle || !content.trim()) return;
    setAiLoadingTitle(true);
    setAiError(null);
    try {
      const generatedTitle = await generateTitle(content, aiSettings);
      if (!generatedTitle) { setAiError('No title returned.'); return; }
      setTitle(generatedTitle);
      showToast('✨ Title generated by AI');
    } catch (err: any) {
      setAiError(err?.message || 'Failed to generate title.');
    } finally {
      setAiLoadingTitle(false);
    }
  }, [content, aiSettings, aiLoadingTitle, showToast]);

  const handleAISummarize = useCallback(async () => {
    if (aiLoadingSummary || !content.trim()) return;
    setAiLoadingSummary(true);
    setAiError(null);
    setSummaryResult(null);
    try {
      const summary = await summarizeNote(title, content, aiSettings);
      setSummaryResult(summary || 'No summary returned.');
    } catch (err: any) {
      setAiError(err?.message || 'Failed to summarize note.');
    } finally {
      setAiLoadingSummary(false);
    }
  }, [title, content, aiSettings, aiLoadingSummary]);

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

        {/* Tags Input */}
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
            onClick={handleAISuggestTags}
            disabled={aiLoadingTag || (!content.trim() && !title.trim())}
            className="inline-flex items-center gap-1 px-2.5 py-2 text-[11px] font-semibold rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            title="AI: Suggest tags from note content"
          >
            {aiLoadingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tag className="w-3 h-3" />}
            <span>AI Tags</span>
          </button>
        </div>

        {/* AI Panel */}
        <div className="flex flex-wrap items-center gap-2 py-1.5 px-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-900/60">
          <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider shrink-0">
            <Sparkles className="w-3 h-3" />
            <span>AI Assist</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleAIGenerateTitle}
              disabled={aiLoadingTitle || !content.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="AI: Generate a title from content"
            >
              {aiLoadingTitle ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Generate Title
            </button>
            <button
              type="button"
              onClick={handleAISummarize}
              disabled={aiLoadingSummary || !content.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="AI: Summarize note as bullet points"
            >
              {aiLoadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3" />}
              Summarize
            </button>
          </div>
          {aiError && (
            <span className="text-[11px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{aiError}
            </span>
          )}
        </div>

        {/* AI Summary Result Panel */}
        {summaryResult && (
          <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-950/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Summary
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setContent(prev => prev ? `${prev}\n\n---\n\n**AI Summary**\n${summaryResult}` : summaryResult);
                    setSummaryResult(null);
                    showToast('Summary appended to note');
                  }}
                  className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >Append to note</button>
                <button type="button" onClick={() => setSummaryResult(null)} className="p-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors">
                  <X className="w-3 h-3 text-purple-500" />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-800 dark:text-gray-200 font-sans-myanmar whitespace-pre-line leading-relaxed">
              {summaryResult}
            </div>
          </div>
        )}

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
              {/* Word count + read time bar */}
              {content.trim() && (
                <div className="flex items-center gap-3 px-1 pt-1 text-[10px] font-mono text-gray-400 dark:text-gray-500 shrink-0">
                  <span>{wordStats.words.toLocaleString()} words</span>
                  <span>·</span>
                  <span>{wordStats.chars.toLocaleString()} chars</span>
                  <span>·</span>
                  <span>~{wordStats.readTime} min read</span>
                </div>
              )}
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
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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

            {/* Modal Content Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Template Selection List (5 cols) */}
              <div className="md:col-span-5 space-y-2 max-h-[380px] overflow-y-auto pr-1">
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

              {/* Template Preview Pane (7 cols) */}
              <div className="md:col-span-7 flex flex-col bg-slate-50 dark:bg-gray-950/80 border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-[380px]">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                    <span>{selectedTemplate.icon}</span>
                    <span>{selectedTemplate.name} Preview</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">Markdown Format</span>
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-[11px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded border border-gray-200/80 dark:border-gray-800 leading-relaxed select-text">
                  {selectedTemplate.getContent(new Date().toISOString().split('T')[0])}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/40">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Mode: <strong className="text-gray-700 dark:text-gray-200 capitalize">{templateMode}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(selectedTemplate)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-md shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span>Apply "{selectedTemplate.name}" Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

