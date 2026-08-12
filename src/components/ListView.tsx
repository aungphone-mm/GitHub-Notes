import React, { useMemo, useState } from 'react';
import { Habit, NoteHeader } from '../types';
import { completedOn, formatDateKey, loadLocalCompletions, loadLocalHabits } from '../lib/habits';
import { groupNotesByDate, datesForNote } from '../lib/noteDates';
import { Check, Clock, FileText, List, Plus, Star, Calendar as CalendarIcon } from 'lucide-react';

interface ListViewProps {
  notes: NoteHeader[];
  selectedPath: string | null;
  onSelectNote: (path: string) => void;
  onNewNoteForDate: (dateStr: string) => void;
  onToggleFavorite?: (path: string) => void;
}

/** Key used for the trailing bucket of notes that carry no date at all. */
const UNDATED = 'undated';

interface DayGroup {
  key: string;
  notes: NoteHeader[];
  doneHabits: Habit[];
}

export const ListView: React.FC<ListViewProps> = ({
  notes,
  selectedPath,
  onSelectNote,
  onNewNoteForDate,
  onToggleFavorite
}) => {
  // Habit history, read once on mount. The Habit Tracker owns this state and
  // writes it through to local storage on every edit.
  //
  // A mount-time read stays current because the tracker and this list are never
  // mounted together: App picks one view via a ternary chain, and the differing
  // component type at that position forces a remount on every switch. So any
  // tick made in the tracker has been flushed to storage before this re-reads.
  // Keep this component inside that same ternary chain — hoisting it to a
  // permanently-mounted parent would leave the list showing stale habits.
  const [habits] = useState(() => loadLocalHabits());
  const [completions] = useState(() => loadLocalCompletions());

  const todayStr = useMemo(() => formatDateKey(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateKey(d);
  }, []);

  /**
   * One group per date that actually has something on it, newest first.
   *
   * Seeded from the union of dates found in notes and dates with habit
   * completions, so a day with nothing on it is never built in the first place
   * — there is no calendar range to filter down.
   */
  const groups = useMemo<DayGroup[]>(() => {
    const notesByDate = groupNotesByDate(notes);
    const habitById = new Map(habits.map(h => [h.id, h]));

    const dateKeys = new Set<string>([
      ...notesByDate.keys(),
      ...Object.keys(completions)
    ]);

    const dated: DayGroup[] = [];

    for (const dateStr of dateKeys) {
      const dayNotes = notesByDate.get(dateStr) || [];

      // completedOn drops ids belonging to deleted habits, so a date whose
      // stored completions are all stale resolves to nothing and drops out.
      const doneHabits = completedOn(completions, dateStr, habits)
        .map(id => habitById.get(id))
        .filter((h): h is Habit => Boolean(h));

      if (dayNotes.length === 0 && doneHabits.length === 0) continue;

      dated.push({ key: dateStr, notes: dayNotes, doneHabits });
    }

    dated.sort((a, b) => b.key.localeCompare(a.key));

    // Notes with no date anywhere in them still belong in a list of "all
    // notes", so they trail the dated groups rather than disappearing.
    const undatedNotes = notes.filter(note => datesForNote(note).length === 0);
    if (undatedNotes.length > 0) {
      dated.push({ key: UNDATED, notes: undatedNotes, doneHabits: [] });
    }

    return dated;
  }, [notes, habits, completions]);

  const totals = useMemo(() => {
    const notesShown = new Set<string>();
    let habitTicks = 0;

    for (const group of groups) {
      group.notes.forEach(n => notesShown.add(n.path));
      habitTicks += group.doneHabits.length;
    }

    return { notes: notesShown.size, habitTicks, days: groups.length };
  }, [groups]);

  const formatDayLabel = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('default', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden transition-colors">
      {/* Header */}
      <div className="shrink-0 px-3 sm:px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <List className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 font-sans tracking-tight truncate">
            All Notes &amp; Habits
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono font-bold">
          <span className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
            {totals.notes} {totals.notes === 1 ? 'note' : 'notes'}
          </span>
          <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
            {totals.habitTicks} habit {totals.habitTicks === 1 ? 'tick' : 'ticks'}
          </span>
          <span className="hidden sm:inline px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            {totals.days} {totals.days === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {/* Grouped scroll area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 space-y-5 bg-gray-50/50 dark:bg-gray-950/40">
        {groups.length === 0 ? (
          <div className="p-10 text-center text-xs text-gray-400 dark:text-gray-500 font-sans space-y-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="font-medium text-gray-600 dark:text-gray-300">Nothing to list yet</p>
            <p className="text-[11px]">
              Connect a repository to load notes, or tick a habit in the Habit Tracker.
            </p>
          </div>
        ) : (
          groups.map(group => {
            const isUndated = group.key === UNDATED;
            const isToday = group.key === todayStr;
            const isYesterday = group.key === yesterdayStr;

            return (
              <section key={group.key} className="space-y-2">
                {/* Date header */}
                <div className="flex items-center justify-between gap-2 sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-2xs">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 font-sans truncate">
                      {isUndated ? 'Undated' : formatDayLabel(group.key)}
                    </h3>

                    {isToday && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        TODAY
                      </span>
                    )}
                    {isYesterday && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        YESTERDAY
                      </span>
                    )}
                    {!isUndated && (
                      <span className="hidden sm:inline shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                        {group.key}
                      </span>
                    )}
                  </div>

                  {!isUndated && (
                    <button
                      type="button"
                      onClick={() => onNewNoteForDate(group.key)}
                      className="shrink-0 p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-gray-200 dark:border-gray-700 transition-colors"
                      title={`Note for ${group.key}`}
                      aria-label={`Note for ${group.key}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Completed habits — only the ones ticked that day are listed */}
                {group.doneHabits.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {group.doneHabits.map(habit => (
                      <span
                        key={habit.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-sans font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                        title={`${habit.name} — ${habit.category}`}
                      >
                        <Check className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[16rem]">{habit.name}</span>
                      </span>
                    ))}

                    {habits.length > 0 && !isUndated && (
                      <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                        {group.doneHabits.length}/{habits.length}
                      </span>
                    )}
                  </div>
                )}

                {/* Notes filed under this date */}
                {group.notes.length > 0 && (
                  <div className="space-y-1.5">
                    {group.notes.map(note => {
                      const isSelected = selectedPath === note.path;

                      return (
                        <div
                          key={`${group.key}:${note.path}`}
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
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer group select-none flex flex-col gap-1.5 ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 font-medium shadow-2xs'
                              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-sans text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
                              {note.title || note.name.replace(/\.md$/, '')}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              {note.isDaily && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 rounded font-bold">
                                  <Clock className="w-2.5 h-2.5" /> Daily
                                </span>
                              )}

                              {onToggleFavorite && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(note.path);
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  title={note.isFavorite ? 'Remove from starred' : 'Add to starred'}
                                  aria-label={note.isFavorite ? 'Remove from starred' : 'Add to starred'}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      note.isFavorite
                                        ? 'fill-amber-400 text-amber-500'
                                        : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400'
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate">{note.path}</span>
                          </div>

                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
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
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};
