import React, { useState, useEffect, useCallback } from 'react';
import { AppConfig, NoteHeader, NoteDetail, CommitNode, StatusState } from './types';
import { safeStore } from './lib/storage';
import { listNotes, readNote, saveNote, appendToDailyLog, deleteNote, GitHubApiError } from './lib/githubApi';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { CommitFooter } from './components/CommitFooter';
import { FileText, Edit3 } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => safeStore.loadConfig());
  const [notes, setNotes] = useState<NoteHeader[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteDetail | null>(null);
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'list' | 'editor'>('list');
  const [status, setStatus] = useState<StatusState>({
    type: 'idle',
    message: 'Ready. Configure repository credentials or select a note.'
  });
  const [conflictError, setConflictError] = useState<string | null>(null);

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
  const handleDeleteNote = useCallback(async (path: string, sha: string) => {
    setIsLoading(true);
    setConflictError(null);
    setStatus({
      type: 'loading',
      message: `Deleting note from repository: ${path}...`
    });

    try {
      const result = await deleteNote(config, path, sha);
      const commitSha = result.commitSha || sha;

      addSessionCommit(
        commitSha,
        result.commitMessage,
        path,
        'delete'
      );

      setStatus({
        type: 'success',
        message: `Deleted note: ${path} (${commitSha.substring(0, 7)})`
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
    <div className="min-h-screen flex flex-col bg-[#f2f4f7] text-[#111827]">
      {/* Header Config Bar */}
      <Header
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onForgetToken={handleForgetToken}
        onConnect={handleLoadNotes}
        isLoading={isLoading}
      />

      {/* Global Status Line */}
      <StatusBar
        status={status}
        onClear={() => setStatus({ type: 'idle', message: '' })}
      />

      {/* Mobile Screen Toggle Bar (< md) */}
      <div className="flex md:hidden bg-white border-b border-gray-200 px-3 py-2 gap-2 shadow-2xs z-10">
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'list'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Notes List ({notes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'editor'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Editor {selectedPath ? '• Active' : ''}</span>
        </button>
      </div>

      {/* Main Workspace (Left Sidebar + Note Editor) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden border-b border-gray-200">
        <div className={`h-full ${mobileTab === 'list' ? 'block' : 'hidden'} md:block md:w-80 lg:w-96 shrink-0`}>
          <NoteList
            notes={notes}
            selectedPath={selectedPath}
            onSelectNote={handleSelectNote}
            onNewNote={handleNewNote}
            onRefresh={handleLoadNotes}
            isLoading={isLoading}
            notesFolder={config.notesFolder || 'notes'}
          />
        </div>

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
