import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppConfig, NoteHeader, NoteDetail, CommitNode, StatusState } from './types';
import { safeStore } from './lib/storage';
import { listNotes, readNote, saveNote, appendToDailyLog, deleteNote, GitHubApiError } from './lib/githubApi';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { CalendarView } from './components/CalendarView';
import { HabitTracker } from './components/HabitTracker';
import { CommitFooter } from './components/CommitFooter';
import { FileText, Edit3, Calendar, TrendingUp } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => safeStore.loadConfig());
  const [notes, setNotes] = useState<NoteHeader[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteDetail | null>(null);
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'editor' | 'calendar' | 'habits'>('editor');
  const [mobileTab, setMobileTab] = useState<'list' | 'calendar' | 'editor' | 'habits'>('list');
  const [status, setStatus] = useState<StatusState>({
    type: 'idle',
    message: 'Ready. Configure repository credentials or select a note.'
  });
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Theme state management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('github_notes_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('github_notes_theme', theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Favorites state management
  const [favoritePaths, setFavoritePaths] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('github_notes_favorites');
        if (saved) return new Set(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
    return new Set();
  });

  const handleToggleFavorite = useCallback((path: string) => {
    setFavoritePaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      try {
        localStorage.setItem('github_notes_favorites', JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const notesWithFavorites = useMemo(() => {
    return notes.map(note => ({
      ...note,
      isFavorite: favoritePaths.has(note.path)
    }));
  }, [notes, favoritePaths]);

  // Update & persist config
  const handleUpdateConfig = useCallback((newConfig: AppConfig) => {
    setConfig(newConfig);
    safeStore.saveConfig(newConfig);
  }, []);

  const handleForgetToken = useCallback(() => {
    safeStore.clearToken();
    setConfig(prev => ({ ...prev, token: '' }));
    setStatus({
      type: 'idle',
      message: 'Personal Access Token cleared from storage.'
    });
  }, []);

  // Record a commit node into session history
  const addSessionCommit = useCallback((
    sha: string,
    message: string,
    path: string,
    action: 'add' | 'update' | 'append' | 'delete'
  ) => {
    const shortSha = sha ? sha.substring(0, 7) : 'commit';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newNode: CommitNode = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sha,
      shortSha,
      message,
      timestamp: timeStr,
      path,
      action
    };

    setCommits(prev => [newNode, ...prev].slice(0, 12));
  }, []);

  // Fetch list of notes from GitHub repository tree
  const handleLoadNotes = useCallback(async () => {
    if (!config.owner || !config.repo || !config.token) {
      setStatus({
        type: 'warning',
        message: 'Missing configuration: Please provide Owner, Repository, and Token.'
      });
      return;
    }

    setIsLoading(true);
    setConflictError(null);
    setStatus({
      type: 'loading',
      message: `Fetching tree from https://api.github.com/repos/${config.owner}/${config.repo}...`
    });

    try {
      const fetchedNotes = await listNotes(config);
      setNotes(fetchedNotes);
      setStatus({
        type: 'success',
        message: `Successfully connected! Found ${fetchedNotes.length} note(s) in "${config.notesFolder}/".`
      });
    } catch (err: any) {
      const msg = err instanceof GitHubApiError ? err.message : (err.message || 'Failed to load notes');
      setStatus({
        type: 'error',
        message: msg
      });
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // Initial auto-connect on mount if config is present
  useEffect(() => {
    if (config.owner && config.repo && config.token) {
      handleLoadNotes();
    }
  }, []);

  // Select and read a note
  const handleSelectNote = useCallback(async (path: string) => {
    setSelectedPath(path);
    setIsLoading(true);
    setConflictError(null);
    setMobileTab('editor');
    setStatus({
      type: 'loading',
      message: `Reading note: ${path}...`
    });

    try {
      const noteDetail = await readNote(config, path);
      setCurrentNote(noteDetail);
      setNotes(prev => prev.map(n => n.path === path ? {
        ...n,
        title: noteDetail.title || n.title,
        tags: noteDetail.tags || n.tags,
        content: noteDetail.content
      } : n));
      setStatus({
        type: 'idle',
        message: `Loaded ${path} (SHA: ${noteDetail.sha.substring(0, 7)})`
      });
    } catch (err: any) {
      const msg = err instanceof GitHubApiError ? err.message : (err.message || 'Failed to read note');
      setStatus({
        type: 'error',
        message: msg
      });
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // Trigger New Note
  const handleNewNote = useCallback(() => {
    setSelectedPath(null);
    setCurrentNote(null);
    setConflictError(null);
    setMobileTab('editor');
    setStatus({
      type: 'idle',
      message: 'Composing a new note. Click "Save Note" when ready to commit.'
    });
  }, []);

  // Trigger New Note for Specific Calendar Date
  const handleNewNoteForDate = useCallback((dateStr: string) => {
    // Check if an existing note matches this date (in path or title)
    const existing = notes.find(n => n.path.includes(dateStr) || (n.title && n.title.includes(dateStr)));
    if (existing) {
      handleSelectNote(existing.path);
      return;
    }

    // Set draft note state for selected date
    setSelectedPath(null);
    setCurrentNote({
      path: '',
      sha: '',
      title: dateStr,
      tags: ['daily'],
      content: `# ${dateStr}\n\n- `,
      updated: dateStr
    });
    setConflictError(null);
    setMobileTab('editor');
    setStatus({
      type: 'idle',
      message: `Drafting note for ${dateStr}. Click "Save Note" when ready to commit.`
    });
  }, [notes, handleSelectNote]);

  // Save Note
  const handleSaveNote = useCallback(async (
    path: string,
    rawContent: string,
    existingSha?: string,
    isNew: boolean = false
  ) => {
    setIsLoading(true);
    setConflictError(null);
    setStatus({
      type: 'loading',
      message: `Committing note to ${path}...`
    });

    try {
      const result = await saveNote(config, path, rawContent, existingSha, isNew);

      const commitSha = result.commitSha || result.sha;
      addSessionCommit(
        commitSha,
        result.commitMessage,
        path,
        isNew ? 'add' : 'update'
      );

      setStatus({
        type: 'success',
        message: `Committed note: ${result.commitMessage} (${commitSha.substring(0, 7)})`
      });

      // Reload tree and select newly saved note
      const updatedNotes = await listNotes(config);
      setNotes(updatedNotes);
      setSelectedPath(path);

      // Re-read file to synchronize updated SHA
      const freshNote = await readNote(config, path);
      setCurrentNote(freshNote);
      setNotes(prev => prev.map(n => n.path === path ? {
        ...n,
        title: freshNote.title || n.title,
        tags: freshNote.tags || n.tags,
        content: freshNote.content
      } : n));
    } catch (err: any) {
      if (err instanceof GitHubApiError && err.status === 409) {
        setConflictError(err.message);
        setStatus({
          type: 'warning',
          message: '409 Conflict: Note was updated on GitHub server. Please re-fetch.'
        });
      } else {
        const msg = err instanceof GitHubApiError ? err.message : (err.message || 'Failed to save note');
        setStatus({
          type: 'error',
          message: msg
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [config, addSessionCommit]);

  // Append Daily Log
  const handleAppendDaily = useCallback(async (textToAppend: string) => {
    setIsLoading(true);
    setConflictError(null);
    setStatus({
      type: 'loading',
      message: 'Appending to today\'s daily log...'
    });

    try {
      const result = await appendToDailyLog(config, textToAppend);
      const commitSha = result.commitSha || result.sha;

      addSessionCommit(
        commitSha,
        result.commitMessage,
        result.path,
        'append'
      );

      setStatus({
        type: 'success',
        message: `Appended entry to daily log: ${result.path} (${commitSha.substring(0, 7)})`
      });

      // Reload tree and select daily log
      const updatedNotes = await listNotes(config);
      setNotes(updatedNotes);
      setSelectedPath(result.path);

      const freshNote = await readNote(config, result.path);
      setCurrentNote(freshNote);
    } catch (err: any) {
      const msg = err instanceof GitHubApiError ? err.message : (err.message || 'Failed to append to daily log');
      setStatus({
        type: 'error',
        message: msg
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, addSessionCommit]);

  // Delete Note
  const handleDeleteNote = useCallback(async (path: string, sha?: string) => {
    setIsLoading(true);
    setConflictError(null);
    setStatus({
      type: 'loading',
      message: `Deleting note from repository: ${path}...`
    });

    try {
      const result = await deleteNote(config, path, sha);
      const commitSha = result.commitSha || sha || 'deleted';

      addSessionCommit(
        commitSha,
        result.commitMessage,
        path,
        'delete'
      );

      setStatus({
        type: 'success',
        message: `Deleted note: ${path} (${commitSha.length > 7 ? commitSha.substring(0, 7) : commitSha})`
      });

      handleNewNote();
      const updatedNotes = await listNotes(config);
      setNotes(updatedNotes);
    } catch (err: any) {
      const msg = err instanceof GitHubApiError ? err.message : (err.message || 'Failed to delete note');
      setStatus({
        type: 'error',
        message: msg
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, addSessionCommit, handleNewNote]);

  // Re-fetch current note on 409 conflict
  const handleResolveConflictRefresh = useCallback(() => {
    if (selectedPath) {
      handleSelectNote(selectedPath);
    } else {
      handleLoadNotes();
    }
  }, [selectedPath, handleSelectNote, handleLoadNotes]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#f2f4f7] dark:bg-gray-950 text-[#111827] dark:text-gray-100 transition-colors">
      {/* Header Config Bar */}
      <Header
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onForgetToken={handleForgetToken}
        onConnect={handleLoadNotes}
        isLoading={isLoading}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Global Status Line */}
      <StatusBar
        status={status}
        onClear={() => setStatus({ type: 'idle', message: '' })}
      />

      {/* View Switcher Navigation Bar (Desktop & Mobile) */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between shrink-0 z-10">
        {/* Desktop View Mode Segment */}
        <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveView('editor')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeView === 'editor'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-2xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeView === 'calendar'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-2xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar View</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('habits')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeView === 'habits'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-2xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Habit Tracker</span>
          </button>
        </div>

        {/* Desktop Context Label */}
        <div className="hidden md:block text-xs font-mono text-gray-500 dark:text-gray-400">
          {activeView === 'editor' ? (
            selectedPath ? `Editing: ${selectedPath}` : 'Drafting / Reading Note'
          ) : activeView === 'calendar' ? (
            'Monthly Calendar, Day Logs & Habit History'
          ) : (
            'Habit Routines & GitHub Actions Planner'
          )}
        </div>

        {/* Mobile View Selector Bar (< md) */}
        <div className="flex md:hidden w-full gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              setMobileTab('list');
              setActiveView('editor');
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition-colors ${
              mobileTab === 'list' && activeView === 'editor'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>List ({notes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('calendar');
              setActiveView('calendar');
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition-colors ${
              mobileTab === 'calendar' || activeView === 'calendar'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('habits');
              setActiveView('habits');
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition-colors ${
              mobileTab === 'habits' || activeView === 'habits'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Habits</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('editor');
              setActiveView('editor');
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1 transition-colors ${
              mobileTab === 'editor' && activeView === 'editor'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {activeView === 'habits' || mobileTab === 'habits' ? (
          <div className="w-full h-full flex-1">
            <HabitTracker
              config={config}
              notes={notesWithFavorites}
              selectedPath={selectedPath}
              onCommit={(sha, message, path) => addSessionCommit(sha, message, path, 'update')}
            />
          </div>
        ) : activeView === 'calendar' || mobileTab === 'calendar' ? (
          <div className="w-full h-full flex-1">
            <CalendarView
              notes={notesWithFavorites}
              selectedPath={selectedPath}
              onSelectNote={(path) => {
                handleSelectNote(path);
                setActiveView('editor');
                setMobileTab('editor');
              }}
              onNewNoteForDate={(dateStr) => {
                handleNewNoteForDate(dateStr);
                setActiveView('editor');
                setMobileTab('editor');
              }}
              notesFolder={config.notesFolder || 'notes'}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        ) : (
          <>
            {/* Note List Sidebar */}
            <div className={`h-full ${mobileTab === 'list' ? 'block' : 'hidden'} md:block md:w-80 lg:w-96 shrink-0`}>
              <NoteList
                notes={notesWithFavorites}
                selectedPath={selectedPath}
                onSelectNote={(path) => {
                  handleSelectNote(path);
                  setMobileTab('editor');
                }}
                onNewNote={() => {
                  handleNewNote();
                  setMobileTab('editor');
                }}
                onRefresh={handleLoadNotes}
                isLoading={isLoading}
                notesFolder={config.notesFolder || 'notes'}
                onToggleFavorite={handleToggleFavorite}
                onDeleteNote={handleDeleteNote}
                config={config}
              />
            </div>

            {/* Note Editor Main Pane */}
            <div className={`h-full flex-1 ${mobileTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col min-w-0`}>
              <NoteEditor
                config={config}
                currentNote={currentNote}
                onSaveNote={handleSaveNote}
                onAppendToDaily={handleAppendDaily}
                onDeleteNote={handleDeleteNote}
                onNewNote={handleNewNote}
                isLoading={isLoading}
                conflictError={conflictError}
                onResolveConflictRefresh={handleResolveConflictRefresh}
                onBackToList={() => setMobileTab('list')}
              />
            </div>
          </>
        )}
      </div>

      {/* Signature Session Commit Footer */}
      <CommitFooter
        commits={commits}
        owner={config.owner}
        repo={config.repo}
      />
    </div>
  );
}
