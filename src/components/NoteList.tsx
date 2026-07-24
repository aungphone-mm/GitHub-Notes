import React, { useState, useMemo } from 'react';
import { NoteHeader } from '../types';
import { Plus, RefreshCw, Calendar, FileText, Search, X } from 'lucide-react';

interface NoteListProps {
  notes: NoteHeader[];
  selectedPath: string | null;
  onSelectNote: (path: string) => void;
  onNewNote: () => void;
  onRefresh?: () => void;
  isLoading: boolean;
  notesFolder: string;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  selectedPath,
  onSelectNote,
  onNewNote,
  onRefresh,
  isLoading,
  notesFolder
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter notes client-side by title, content, path, name, or tags
  const filteredNotes = useMemo(() => {
    if (!searchTerm.trim()) return notes;
    const term = searchTerm.toLowerCase();
    return notes.filter(n => {
      const matchTitle = n.title ? n.title.toLowerCase().includes(term) : false;
      const matchContent = n.content ? n.content.toLowerCase().includes(term) : false;
      const matchName = n.name ? n.name.toLowerCase().includes(term) : false;
      const matchPath = n.path ? n.path.toLowerCase().includes(term) : false;
      const matchTags = n.tags ? n.tags.some(t => t.toLowerCase().includes(term)) : false;

      return matchTitle || matchContent || matchName || matchPath || matchTags;
    });
  }, [notes, searchTerm]);

  return (
    <aside className="w-full h-full bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Top Header Controls */}
      <div className="p-3 border-b border-gray-200 space-y-2 bg-white">
        {/* Buttons Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewNote}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors shadow-2xs"
              title="Refresh notes from GitHub"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          )}
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes by title or content..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-gray-800 placeholder-gray-400 transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Note List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-white">
        {isLoading && notes.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 font-sans">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mb-2" />
            <p>Loading notes...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-12 text-center text-xs font-medium text-gray-400 select-none space-y-1">
            <p>{searchTerm ? 'No matching notes found' : 'No notes loaded'}</p>
            {searchTerm && (
              <p className="text-[11px] text-gray-400 font-normal">
                Try searching for another keyword or title.
              </p>
            )}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isSelected = selectedPath === note.path;

            return (
              <button
                key={note.path}
                type="button"
                onClick={() => onSelectNote(note.path)}
                aria-current={isSelected ? 'true' : undefined}
                className={`w-full text-left p-3 transition-colors flex flex-col gap-1 focus:outline-none ${
                  isSelected
                    ? 'bg-blue-50/90 border-l-4 border-l-blue-600 font-medium'
                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-sans-myanmar text-xs font-semibold text-gray-900 line-clamp-1">
                    {note.title || note.name.replace(/\.md$/, '')}
                  </span>
                  {note.isDaily && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold shrink-0">
                      <Calendar className="w-2.5 h-2.5" /> Daily
                    </span>
                  )}
                </div>

                <div className="font-mono text-[10px] text-gray-400 truncate flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{note.path}</span>
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {note.tags.map(t => (
                      <span
                        key={t}
                        className="text-[9px] font-mono bg-gray-100 text-gray-600 px-1 py-0.2 rounded"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};


