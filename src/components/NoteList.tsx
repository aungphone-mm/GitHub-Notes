import React, { useState, useMemo, useEffect } from 'react';
import { NoteHeader, AppConfig } from '../types';
import {
  Plus,
  RefreshCw,
  Calendar,
  FileText,
  Search,
  X,
  Star,
  Github,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Filter,
  Tag,
  Hash,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { searchNotesCode } from '../lib/githubApi';

interface NoteListProps {
  notes: NoteHeader[];
  selectedPath: string | null;
  onSelectNote: (path: string) => void;
  onNewNote: () => void;
  onRefresh?: () => void;
  isLoading: boolean;
  notesFolder?: string;
  onToggleFavorite?: (path: string) => void;
  onDeleteNote?: (path: string, sha?: string) => void;
  config?: AppConfig;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  selectedPath,
  onSelectNote,
  onNewNote,
  onRefresh,
  isLoading,
  onToggleFavorite,
  onDeleteNote,
  config
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'favorites'>('all');
  const [useGithubSearch, setUseGithubSearch] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isTagCloudExpanded, setIsTagCloudExpanded] = useState(true);
  const [noteToDelete, setNoteToDelete] = useState<{ path: string; sha?: string } | null>(null);

  // GitHub Code Search state
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [codeSearchResults, setCodeSearchResults] = useState<{ path: string; name: string; sha: string }[] | null>(null);
  const [codeSearchError, setCodeSearchError] = useState<string | null>(null);

  const favoriteCount = useMemo(() => {
    return notes.filter(n => n.isFavorite).length;
  }, [notes]);

  // Extract and count tags across all loaded notes for Tag Cloud
  const tagCloudData = useMemo(() => {
    const tagCounts: Record<string, number> = {};

    notes.forEach(note => {
      const noteTags = new Set<string>();

      // 1. Tags array from note header frontmatter
      if (note.tags && Array.isArray(note.tags)) {
        note.tags.forEach(t => {
          if (t && t.trim()) noteTags.add(t.trim().toLowerCase());
        });
      }

      // 2. Daily tag
      if (note.isDaily) {
        noteTags.add('daily');
      }

      // 3. Extract #hashtags from title, content, path or name
      const fullText = `${note.title || ''} ${note.content || ''} ${note.name || ''}`;
      const hashtagRegex = /(?:^|\s)#([a-zA-Z0-9_\-]+)/g;
      let match;
      while ((match = hashtagRegex.exec(fullText)) !== null) {
        const tag = match[1].toLowerCase();
        if (tag.length >= 2 && !/^\d+$/.test(tag)) {
          noteTags.add(tag);
        }
      }

      noteTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [notes]);

  const handleTagSelect = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
      if (searchTerm === tag || searchTerm === `#${tag}`) {
        setSearchTerm('');
      }
    } else {
      setSelectedTag(tag);
      setSearchTerm(tag);
    }
  };

  const isConfigValid = useMemo(() => {
    return !!(config?.owner?.trim() && config?.repo?.trim() && config?.token?.trim());
  }, [config]);

  // Debounced GitHub Code Search API call (/search/code)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setCodeSearchResults(null);
      setCodeSearchError(null);
      setIsSearchingCode(false);
      return;
    }

    // Require at least 3 characters before hitting the GitHub search API
    // to avoid exhausting rate limits on every keystroke.
    if (searchTerm.trim().length < 3) {
      setCodeSearchResults(null);
      setCodeSearchError(null);
      setIsSearchingCode(false);
      return;
    }

    if (!useGithubSearch || !isConfigValid || !config) {
      setCodeSearchResults(null);
      setCodeSearchError(null);
      setIsSearchingCode(false);
      return;
    }

    setIsSearchingCode(true);
    setCodeSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await searchNotesCode(config, searchTerm);
        setCodeSearchResults(results);
        setCodeSearchError(null);
      } catch (err: any) {
        setCodeSearchResults(null);
        setCodeSearchError(err?.githubMessage || err?.message || 'GitHub Code Search unavailable or repository unindexed');
      } finally {
        setIsSearchingCode(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchTerm, useGithubSearch, config, isConfigValid]);

  // Set of matched paths from GitHub search for quick lookup & highlighting
  const githubMatchedPaths = useMemo(() => {
    if (!codeSearchResults) return new Set<string>();
    return new Set(codeSearchResults.map(item => item.path));
  }, [codeSearchResults]);

  // Filter notes combining GitHub Code Search API results, tag filter, and local metadata
  const filteredNotes = useMemo(() => {
    let list = notes;

    if (filterTab === 'favorites') {
      list = list.filter(n => n.isFavorite);
    }

    if (selectedTag) {
      const tagLower = selectedTag.toLowerCase();
      list = list.filter(n => {
        const hasHeaderTag = n.tags && n.tags.some(t => t.toLowerCase() === tagLower);
        const isDailyTag = tagLower === 'daily' && n.isDaily;
        const textToScan = `${n.title || ''} ${n.content || ''} ${n.name || ''} ${n.path || ''}`.toLowerCase();
        const hasTextTag = textToScan.includes(`#${tagLower}`) || textToScan.includes(tagLower);
        return hasHeaderTag || isDailyTag || hasTextTag;
      });
    }

    if (!searchTerm.trim()) return list;

    // If GitHub Code Search results exist and have matches, merge/include results
    if (useGithubSearch && codeSearchResults) {
      const knownPaths = new Set(list.map(n => n.path));

      // Start with items from local list that match github search OR local term
      const matchedLocal = list.filter(n => {
        const matchesGithub = githubMatchedPaths.has(n.path);
        const term = searchTerm.toLowerCase();
        const matchesLocal =
          (n.title && n.title.toLowerCase().includes(term)) ||
          (n.content && n.content.toLowerCase().includes(term)) ||
          (n.name && n.name.toLowerCase().includes(term)) ||
          (n.path && n.path.toLowerCase().includes(term)) ||
          (n.tags && n.tags.some(t => t.toLowerCase().includes(term)));

        return matchesGithub || matchesLocal;
      });

      // Add any items found by GitHub Code Search that might not be in local list yet
      const extraGithubItems: NoteHeader[] = [];
      for (const res of codeSearchResults) {
        if (!knownPaths.has(res.path)) {
          const folderPrefix = (config?.notesFolder || 'notes').trim().replace(/^\/+|\/+$/g, '');
          const isDaily = res.path.includes(`${folderPrefix}/daily/`) || res.path.startsWith('daily/');
          extraGithubItems.push({
            path: res.path,
            name: res.name,
            sha: res.sha,
            isDaily
          });
        }
      }

      // Sort prioritizing GitHub matched items
      return [...extraGithubItems, ...matchedLocal].sort((a, b) => {
        const aMatched = githubMatchedPaths.has(a.path);
        const bMatched = githubMatchedPaths.has(b.path);
        if (aMatched && !bMatched) return -1;
        if (!aMatched && bMatched) return 1;
        return 0;
      });
    }

    // Fallback standard client-side filter
    const term = searchTerm.toLowerCase();
    return list.filter(n => {
      const matchTitle = n.title ? n.title.toLowerCase().includes(term) : false;
      const matchContent = n.content ? n.content.toLowerCase().includes(term) : false;
      const matchName = n.name ? n.name.toLowerCase().includes(term) : false;
      const matchPath = n.path ? n.path.toLowerCase().includes(term) : false;
      const matchTags = n.tags ? n.tags.some(t => t.toLowerCase().includes(term)) : false;

      return matchTitle || matchContent || matchName || matchPath || matchTags;
    });
  }, [notes, filterTab, selectedTag, searchTerm, useGithubSearch, codeSearchResults, githubMatchedPaths, config]);

  return (
    <aside className="w-full h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-colors">
      {/* Top Header Controls */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 space-y-2.5 bg-white dark:bg-gray-900 shrink-0">
        {/* Buttons Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewNote}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-2xs"
            title="Create a new note (Ctrl+Enter)"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors shadow-2xs"
              title="Refresh notes from GitHub"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            </button>
          )}
        </div>

        {/* Filter Tabs (All vs Starred) */}
        <div className="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200/80 dark:border-gray-700/80 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`flex-1 py-1 px-2 rounded text-center transition-colors flex items-center justify-center gap-1 ${
              filterTab === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-200/60 dark:bg-gray-600/60 text-gray-700 dark:text-gray-300">
              {notes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('favorites')}
            className={`flex-1 py-1 px-2 rounded text-center transition-colors flex items-center justify-center gap-1 ${
              filterTab === 'favorites'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Star
              className={`w-3 h-3 ${
                favoriteCount > 0 ? 'fill-amber-400 text-amber-500' : 'text-gray-400'
              }`}
            />
            <span>Starred</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-200/60 dark:bg-gray-600/60 text-gray-700 dark:text-gray-300">
              {favoriteCount}
            </span>
          </button>
        </div>

        {/* Search Bar Input & Controls */}
        <div className="space-y-1.5">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search note content (e.g. #ideas, todo)..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 absolute left-2.5 top-2.5 pointer-events-none" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded transition-colors"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search Mode & GitHub API Status Bar */}
          <div className="flex items-center justify-between gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setUseGithubSearch(!useGithubSearch)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors border ${
                useGithubSearch && isConfigValid
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
              }`}
              title="Toggle GitHub Search API (/search/code)"
            >
              <Github className="w-3 h-3" />
              <span>/search/code</span>
              <span className={`w-1.5 h-1.5 rounded-full ${useGithubSearch && isConfigValid ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            </button>

            {/* Status Indicators */}
            {isSearchingCode ? (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-mono text-[10px]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Searching GitHub...</span>
              </div>
            ) : codeSearchResults !== null ? (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                <span>{codeSearchResults.length} GitHub match{codeSearchResults.length === 1 ? '' : 'es'}</span>
              </div>
            ) : codeSearchError ? (
              <div
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono text-[10px] truncate max-w-[150px]"
                title={codeSearchError}
              >
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">Local fallback</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tag Cloud Visualization Section */}
        {tagCloudData.length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsTagCloudExpanded(!isTagCloudExpanded)}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                <span>Tag Cloud</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-bold">
                  {tagCloudData.length}
                </span>
                {isTagCloudExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
              </button>

              {selectedTag && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTag(null);
                    setSearchTerm('');
                  }}
                  className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Tag Filter</span>
                </button>
              )}
            </div>

            {isTagCloudExpanded && (
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 bg-slate-50/80 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-800">
                {tagCloudData.map(({ tag, count }) => {
                  const isSelected = selectedTag === tag;
                  const isTopTag = count >= 3;
                  const isMidTag = count === 2;

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagSelect(tag)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-sans transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-2xs border border-blue-700'
                          : isTopTag
                          ? 'bg-blue-100/80 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-semibold hover:bg-blue-200 dark:hover:bg-blue-900'
                          : isMidTag
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/80'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={`Filter by tag #${tag} (${count} note${count === 1 ? '' : 's'})`}
                    >
                      <Hash className={`w-2.5 h-2.5 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                      <span>{tag}</span>
                      <span className={`text-[9px] font-mono px-1 rounded-full ${
                        isSelected
                          ? 'bg-blue-700 text-white font-bold'
                          : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/80 bg-white dark:bg-gray-900">
        {isLoading && notes.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 font-sans">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent mb-2" />
            <p>Loading notes...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-10 text-center text-xs font-medium text-gray-400 dark:text-gray-500 select-none space-y-1.5">
            {filterTab === 'favorites' && !searchTerm ? (
              <>
                <Star className="w-6 h-6 mx-auto text-amber-400/80 fill-amber-400/20 mb-1" />
                <p className="text-gray-600 dark:text-gray-300 font-semibold">No starred notes yet</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-normal max-w-[220px] mx-auto">
                  Click the star icon on any note in your list to mark it as starred.
                </p>
              </>
            ) : (
              <>
                <p>{searchTerm ? 'No matching notes found' : 'No notes loaded'}</p>
                {searchTerm && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-normal">
                    Try searching for another keyword or phrase.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          filteredNotes.map(note => {
            const isSelected = selectedPath === note.path;
            const isGithubMatch = githubMatchedPaths.has(note.path);

            return (
              <div
                key={note.path}
                onClick={() => onSelectNote(note.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNote(note.path);
                  }
                }}
                aria-current={isSelected ? 'true' : undefined}
                className={`w-full text-left p-3 transition-colors flex flex-col gap-1 focus:outline-none cursor-pointer group select-none ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-4 border-l-blue-600 dark:border-l-blue-500 font-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-sans text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
                    {note.title || note.name.replace(/\.md$/, '')}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {isGithubMatch && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-blue-100 dark:bg-blue-950/90 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 px-1.5 py-0.2 rounded font-bold" title="Matched via GitHub /search/code">
                        <Github className="w-2.5 h-2.5" /> Code Match
                      </span>
                    )}

                    {note.isDaily && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 rounded font-bold">
                        <Calendar className="w-2.5 h-2.5" /> Daily
                      </span>
                    )}

                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(note.path);
                        }}
                        className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
                        title={note.isFavorite ? 'Remove from starred' : 'Add to starred'}
                        aria-label={note.isFavorite ? 'Remove from starred' : 'Add to starred'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 transition-colors ${
                            note.isFavorite
                              ? 'fill-amber-400 text-amber-500 dark:text-amber-400'
                              : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500'
                          }`}
                        />
                      </button>
                    )}

                    {onDeleteNote && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteToDelete({ path: note.path, sha: note.sha });
                        }}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Delete note"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{note.path}</span>
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {note.tags.map(t => (
                      <span
                        key={t}
                        className="text-[9px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-gray-700 px-1 py-0.2 rounded"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Note Deletion Modal Confirmation */}
      {noteToDelete && onDeleteNote && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span>Delete Note?</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
              Are you sure you want to delete <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{noteToDelete.path}</span>?
              This will create a real <code className="font-mono bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 px-1 py-0.5 rounded">DELETE</code> commit on your GitHub repository.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = noteToDelete;
                  setNoteToDelete(null);
                  await onDeleteNote(target.path, target.sha);
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 rounded-md shadow-2xs transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

