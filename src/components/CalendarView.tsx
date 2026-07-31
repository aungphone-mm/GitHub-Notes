import React, { useState, useMemo } from 'react';
import { NoteHeader } from '../types';
import { completedOn, formatDateKey, loadLocalCompletions, loadLocalHabits } from '../lib/habits';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Star, FileText, Clock, Check, Circle } from 'lucide-react';

interface CalendarViewProps {
  notes: NoteHeader[];
  selectedPath: string | null;
  onSelectNote: (path: string) => void;
  onNewNoteForDate: (dateStr: string) => void;
  notesFolder: string;
  onToggleFavorite?: (path: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  notes,
  selectedPath,
  onSelectNote,
  onNewNoteForDate,
  onToggleFavorite
}) => {
  // State for currently viewed month/year in the calendar
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  // Selected single date on calendar grid (defaults to today's date)
  const todayStr = useMemo(() => formatDateKey(new Date()), []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Habit history, read once on mount. The Habit Tracker owns this state and
  // writes it through to local storage on every edit.
  //
  // A mount-time read stays current because the tracker and the calendar are
  // never mounted together: App picks one via a ternary, and the differing
  // component type at that position forces a remount on every switch. So any
  // tick made in the tracker has been flushed to storage before this re-reads.
  // Read-only here — ticking happens in the Habit Tracker tab.
  const [habits] = useState(() => loadLocalHabits());
  const [completions] = useState(() => loadLocalCompletions());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Map each YYYY-MM-DD string to list of notes saved/associated with that date
  const notesByDate = useMemo(() => {
    const map = new Map<string, NoteHeader[]>();

    for (const note of notes) {
      const datesFound = new Set<string>();

      // Match YYYY-MM-DD in path or filename (e.g. daily/2026-07-24.md or 2026-07-24-notes.md)
      const pathMatches = note.path.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
      if (pathMatches) {
        pathMatches.forEach(d => datesFound.add(d));
      }

      // Match YYYY-MM-DD in title
      if (note.title) {
        const titleMatches = note.title.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
        if (titleMatches) {
          titleMatches.forEach(d => datesFound.add(d));
        }
      }

      // Match updated timestamp date (e.g. 2026-07-24T...)
      if (note.updated) {
        const updatedDateStr = note.updated.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(updatedDateStr)) {
          datesFound.add(updatedDateStr);
        }
      }

      // Add note to each matched date in the map
      for (const d of datesFound) {
        const list = map.get(d) || [];
        list.push(note);
        map.set(d, list);
      }
    }

    return map;
  }, [notes]);

  // Navigate month
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(formatDateKey(now));
  };

  // Calendar grid calculations
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = formatDateKey(d);
      days.push({
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = formatDateKey(d);
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = formatDateKey(d);
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    return days;
  }, [year, month, todayStr]);

  // Month label
  const monthLabel = useMemo(() => {
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Selected date notes
  const selectedDateNotes = useMemo(() => {
    return notesByDate.get(selectedDateStr) || [];
  }, [notesByDate, selectedDateStr]);

  // Which habits were completed on the selected date, split for the side panel.
  const selectedDateHabits = useMemo(() => {
    const doneIds = new Set(completedOn(completions, selectedDateStr, habits));
    return habits.map(habit => ({ habit, isDone: doneIds.has(habit.id) }));
  }, [completions, selectedDateStr, habits]);

  const selectedDateDoneCount = useMemo(
    () => selectedDateHabits.filter(h => h.isDone).length,
    [selectedDateHabits]
  );

  // Formatted date label for selected date header
  const selectedDateLabel = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }, [selectedDateStr]);

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col md:flex-row overflow-hidden transition-colors">
      {/* Left Main Section: Monthly Calendar Grid */}
      <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800">
        {/* Calendar Header Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-sans tracking-tight">
              {monthLabel}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-mono font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Jump to today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-[320px]">
          {calendarDays.map(({ dateStr, dayNumber, isCurrentMonth, isToday }) => {
            const dayNotes = notesByDate.get(dateStr) || [];
            const hasNotes = dayNotes.length > 0;
            const hasFavorite = dayNotes.some(n => n.isFavorite);
            const isSelected = dateStr === selectedDateStr;

            const habitsDone = completedOn(completions, dateStr, habits).length;
            const allHabitsDone = habits.length > 0 && habitsDone === habits.length;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDateStr(dateStr)}
                className={`relative p-2 rounded-lg text-left transition-all flex flex-col justify-between border ${
                  isSelected
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/90 dark:bg-blue-950/70 shadow-sm font-bold ring-2 ring-blue-500/20'
                    : isToday
                    ? 'border-amber-400 dark:border-amber-500/80 bg-amber-50/60 dark:bg-amber-950/40'
                    : isCurrentMonth
                    ? 'border-gray-200/80 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 bg-white dark:bg-gray-900'
                    : 'border-transparent text-gray-300 dark:text-gray-700 bg-gray-50/20 dark:bg-gray-950/20 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-mono ${
                      isToday
                        ? 'text-amber-700 dark:text-amber-400 font-extrabold'
                        : isSelected
                        ? 'text-blue-700 dark:text-blue-300 font-extrabold'
                        : isCurrentMonth
                        ? 'text-gray-800 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  {hasFavorite && (
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                  )}
                </div>

                {/* Notes + Habit Indicator Pills */}
                {(hasNotes || habitsDone > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {hasNotes && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                        {dayNotes.length} {dayNotes.length === 1 ? 'note' : 'notes'}
                      </span>
                    )}

                    {habitsDone > 0 && (
                      <span
                        title={`${habitsDone} of ${habits.length} habits completed`}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
                          allHabitsDone
                            ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {allHabitsDone && <Check className="w-2.5 h-2.5 shrink-0" />}
                        <span>{habitsDone}/{habits.length}</span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Side Section: Selected Date Notes & Quick Action */}
      <div className="w-full md:w-80 lg:w-96 p-4 md:p-6 flex flex-col space-y-4 bg-gray-50/50 dark:bg-gray-950/40 overflow-y-auto shrink-0">
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 font-sans">
              {selectedDateLabel}
            </h3>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
              {selectedDateNotes.length} {selectedDateNotes.length === 1 ? 'note' : 'notes'} linked to date
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNewNoteForDate(selectedDateStr)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
            title={`Create note for ${selectedDateStr}`}
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>

        {/* Habit completions for the selected date (read-only; tick in Habit Tracker) */}
        {habits.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 font-sans flex items-center gap-1.5">
                <span>📊</span>
                <span>Habits</span>
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  selectedDateDoneCount === habits.length
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                }`}
              >
                {selectedDateDoneCount}/{habits.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {selectedDateHabits.map(({ habit, isDone }) => (
                <div key={habit.id} className="flex items-center gap-2">
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-3 h-3 shrink-0 text-gray-300 dark:text-gray-600" />
                  )}
                  <span
                    className={`text-xs font-sans truncate ${
                      isDone
                        ? 'text-gray-700 dark:text-gray-200 font-medium'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {habit.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List of notes saved for selected date */}
        <div className="space-y-2 flex-1">
          {selectedDateNotes.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 font-sans space-y-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-600 dark:text-gray-300">No notes for this date</p>
              <button
                type="button"
                onClick={() => onNewNoteForDate(selectedDateStr)}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Draft note for {selectedDateStr}
              </button>
            </div>
          ) : (
            selectedDateNotes.map(note => {
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
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer group select-none flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 font-medium shadow-2xs'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-sans text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                      {note.title || note.name.replace(/\.md$/, '')}
                    </span>

                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(note.path);
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={note.isFavorite ? 'Starred' : 'Star note'}
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

                  <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{note.path}</span>
                  </div>

                  {note.updated && (
                    <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{note.updated}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
