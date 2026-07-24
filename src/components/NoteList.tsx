import React, { useState, useMemo } from 'react';
import { NoteHeader } from '../types';
import { Plus, RefreshCw, Calendar, FileText, Search, X, Star } from 'lucide-react';

interface NoteListProps {
  notes: NoteHeader[];
  selectedPath: string | null;
  onSelectNote: (path: string) => void;
  onNewNote: () => void;
  onRefresh?: () => void;
  isLoading: boolean;
  notesFolder?: string;
  onToggleFavorite?: (path: string) => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  selectedPath,
  onSelectNote,
  onNewNote,
  onRefresh,
  isLoading,
  onToggleFavorite
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'favorites'>('all');

  const favoriteCount = useMemo(() => {
    return notes.filter(n => n.isFavorite).length;
  }, [notes]);

  // Filter notes client-side by favorites tab, title, content, path, name, or tags
  const filteredNotes = useMemo(() => {
    let list = notes;

    if (filterTab === 'favorites') {
      list = list.filter(n => n.isFavorite);
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter(n => {
      const matchTitle = n.title ? n.title.toLowerCase().includes(term) : false;
      const matchContent = n.content ? n.content.toLowerCase().includes(term) : false;
      const matchName = n.name ? n.name.toLowerCase().includes(term) : false;
      const matchPath = n.path ? n.path.toLowerCase().includes(term) : false;
      const matchTags = n.tags ? n.tags.some(t => t.toLowerCase().includes(term)) : false;

      return matchTitle || matchContent || matchName || matchPath || matchTags;
    });
  }, [notes, filterTab, searchTerm]);

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

        {/* Search Bar Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes..."
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
                    Try searching for another keyword or title.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          filteredNotes.map(note => {
            const isSelected = selectedPath === note.path;

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
    </aside>
  );
};
