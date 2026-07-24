import React, { useState, useMemo } from 'react';
import { NoteHeader } from '../types';
import { Search, Plus, FileText, Calendar, Tag, Filter, X } from 'lucide-react';

interface NoteListProps {
  notes: NoteHeader[];
  selectedPath: string | null;
  onSelectNote: (path: string) => void;
  onNewNote: () => void;
  isLoading: boolean;
  notesFolder: string;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  selectedPath,
  onSelectNote,
  onNewNote,
  isLoading,
  notesFolder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Extract all unique tags across notes if available
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      if (n.tags) {
        n.tags.forEach(t => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [notes]);

  // Filter notes client-side
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // Tag filter
      if (selectedTag && (!n.tags || !n.tags.includes(selectedTag))) {
        return false;
      }

      // Search term filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const matchPath = n.path.toLowerCase().includes(term);
      const matchName = n.name.toLowerCase().includes(term);
      const matchTitle = n.title ? n.title.toLowerCase().includes(term) : false;
      const matchTags = n.tags ? n.tags.some(t => t.toLowerCase().includes(term)) : false;

      return matchPath || matchName || matchTitle || matchTags;
    });
  }, [notes, searchTerm, selectedTag]);

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-gray-200 bg-gray-50/60 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onNewNote}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-2xs active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
            <span className="text-[10px] font-mono opacity-80 ml-auto hidden sm:inline">⌘+Enter</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes, paths, tags..."
            className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-sm sm:text-xs bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3 sm:top-2.5" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2.5 sm:top-2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Tag filter pills */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none text-[11px]">
            <Filter className="w-3 h-3 text-gray-400 shrink-0" />
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 transition-colors ${
                selectedTag === null
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({notes.length})
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 transition-colors ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note List Header Counter */}
      <div className="px-3 py-1.5 bg-gray-100/70 border-b border-gray-200 text-[11px] font-mono text-gray-500 flex justify-between items-center">
        <span>
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'} found
        </span>
        <span className="truncate max-w-[140px] text-gray-400">
          {notesFolder}/
        </span>
      </div>

      {/* Note List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {isLoading && notes.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mb-2" />
            <p>Fetching notes from GitHub tree...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 space-y-2">
            <p className="font-medium text-gray-700">No notes found</p>
            <p className="text-[11px] text-gray-400">
              {searchTerm || selectedTag
                ? 'Try clearing your search filters.'
                : 'Click "New Note" to compose your first Markdown note.'}
            </p>
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
                className={`w-full text-left p-3 transition-colors flex flex-col gap-1 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isSelected
                    ? 'bg-blue-50/80 border-l-4 border-l-blue-600 font-medium'
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

                {/* Path */}
                <div className="font-mono text-[10px] text-gray-400 truncate flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{note.path}</span>
                </div>

                {/* Tags if present */}
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
