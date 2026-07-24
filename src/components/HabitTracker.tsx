import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Habit, HabitCompletions, NoteHeader } from '../types';
import { safeStore } from '../lib/storage';
import {
  CheckCircle2,
  Circle,
  Plus,
  Flame,
  Calendar as CalendarIcon,
  Sparkles,
  Copy,
  Check,
  Trash2,
  ListTodo,
  TrendingUp,
  FileCode,
  Github,
  Award,
  ChevronLeft,
  ChevronRight,
  Send
} from 'lucide-react';

interface HabitTrackerProps {
  notes?: NoteHeader[];
  selectedPath?: string | null;
  onAppendToDailyNote?: (contentToAppend: string) => void;
  onNewNoteForDate?: (dateStr: string) => void;
}

const HABITS_STORAGE_KEY = 'gh_notes_habits_v1';
const COMPLETIONS_STORAGE_KEY = 'gh_notes_habit_completions_v1';

const DEFAULT_HABITS: Habit[] = [
  {
    id: 'h1',
    name: 'Top 3 Priorities Completed',
    category: 'Productivity',
    color: 'bg-blue-500',
    targetPerWeek: 5
  },
  {
    id: 'h2',
    name: 'Hourly Focus Grid Check-in',
    category: 'Productivity',
    color: 'bg-indigo-500',
    targetPerWeek: 5
  },
  {
    id: 'h3',
    name: 'Daily Git Commit / Code Review',
    category: 'Routine',
    color: 'bg-emerald-500',
    targetPerWeek: 7
  },
  {
    id: 'h4',
    name: '30-min Learning & Reading',
    category: 'Learning',
    color: 'bg-amber-500',
    targetPerWeek: 5
  },
  {
    id: 'h5',
    name: 'Evening Review & Checklist',
    category: 'Mindfulness',
    color: 'bg-purple-500',
    targetPerWeek: 7
  }
];

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  onAppendToDailyNote,
  onNewNoteForDate
}) => {
  // 1. Load State
  const [habits, setHabits] = useState<Habit[]>(() => {
    const raw = safeStore.getItem(HABITS_STORAGE_KEY);
    if (!raw) return DEFAULT_HABITS;
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_HABITS;
    }
  });

  const [completions, setCompletions] = useState<HabitCompletions>(() => {
    const raw = safeStore.getItem(COMPLETIONS_STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  });

  // Selected date offset relative to today
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // New Habit Modal / Form
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitCategory, setNewHabitCategory] = useState<Habit['category']>('Productivity');

  // Copy Feedback
  const [copiedSection, setCopiedSection] = useState<'workflow' | 'planner' | null>(null);
  const [loggedToNoteStatus, setLoggedToNoteStatus] = useState<string | null>(null);

  // Save to local storage on change
  useEffect(() => {
    safeStore.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    safeStore.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
  }, [completions]);

  // Generate date list for current week view (7 days centered around current weekOffset)
  const weekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate start of week (Monday)
    const dayOfWeek = today.getDay(); // 0 is Sun
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + weekOffset * 7);

    const days: Array<{ dateStr: string; dayName: string; dayNumber: number; isToday: boolean }> = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday: dateStr === todayStr
      });
    }

    return days;
  }, [weekOffset]);

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Toggle habit completion for a specific date
  const toggleHabit = useCallback((habitId: string, dateStr: string) => {
    setCompletions(prev => {
      const currentList = prev[dateStr] || [];
      const exists = currentList.includes(habitId);

      const updated = exists
        ? currentList.filter(id => id !== habitId)
        : [...currentList, habitId];

      return {
        ...prev,
        [dateStr]: updated
      };
    });
  }, []);

  // Calculate Streak for a habit
  const calculateStreak = useCallback((habitId: string): number => {
    let streak = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Check backwards from today (or yesterday if today not checked yet)
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];

      const completedToday = (completions[dStr] || []).includes(habitId);
      if (completedToday) {
        streak++;
      } else {
        // If today is not checked yet, don't break streak on today unless yesterday was also missed
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  }, [completions]);

  // Today progress statistics
  const todayCompletedCount = useMemo(() => {
    return (completions[todayStr] || []).length;
  }, [completions, todayStr]);

  const todayPercentage = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.round((todayCompletedCount / habits.length) * 100);
  }, [todayCompletedCount, habits.length]);

  // Add Habit
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-indigo-500'];
    const randomColor = colors[habits.length % colors.length];

    const newHabit: Habit = {
      id: `h_${Date.now()}`,
      name: newHabitName.trim(),
      category: newHabitCategory,
      color: randomColor,
      targetPerWeek: 7
    };

    setHabits(prev => [...prev, newHabit]);
    setNewHabitName('');
    setIsAddModalOpen(false);
  };

  // Delete Habit
  const handleDeleteHabit = (id: string) => {
    if (confirm('Are you sure you want to delete this habit?')) {
      setHabits(prev => prev.filter(h => h.id !== id));
    }
  };

  // Append Today's Habits into Daily Note
  const handleSyncToDailyNote = () => {
    const todayList = completions[todayStr] || [];
    const markdownChecklist = habits
      .map(h => `- [${todayList.includes(h.id) ? 'x' : ' '}] ${h.name}`)
      .join('\n');

    const habitBlock = `\n\n### 🎯 Daily Habits (${todayStr})\n${markdownChecklist}\n`;

    if (onAppendToDailyNote) {
      onAppendToDailyNote(habitBlock);
      setLoggedToNoteStatus('Logged into today\'s note!');
      setTimeout(() => setLoggedToNoteStatus(null), 3000);
    } else if (onNewNoteForDate) {
      onNewNoteForDate(todayStr);
    }
  };

  // Code snippets for GitHub Action planner
  const yamlWorkflowCode = `name: daily-planner
on:
  schedule: [{ cron: '30 23 * * *' }] # Yangon UTC+6:30 = 23:30 UTC day before
  workflow_dispatch:

jobs:
  open:
    runs-on: ubuntu-latest
    permissions: { issues: write }
    steps:
      - uses: actions/checkout@v4
      - uses: JasonEtco/create-an-issue@v2
        env: { GITHUB_TOKEN: '\${{ secrets.GITHUB_TOKEN }}' }
        with: { filename: .github/PLANNER.md }`;

  const plannerMdTemplate = `---
title: "Daily Planner - %DATE%"
labels: ["daily-planner", "habit-tracker"]
---

## 🎯 Top 3 Priorities
- [ ] Priority 1
- [ ] Priority 2
- [ ] Priority 3

## ⏰ Hourly Grid
- [ ] 09:00 - Morning Standup & Task Triage
- [ ] 11:00 - Deep Work Session
- [ ] 14:00 - Code Review & Pull Requests
- [ ] 17:00 - Evening Review & Reflection

## 📊 Habit Tracker
- [ ] Top 3 Priorities Done
- [ ] Hourly Focus Grid Check-in
- [ ] Daily Git Commit / Code Review
- [ ] 30-min Reading & Learning
- [ ] Evening Checklist Ticked
`;

  const copyToClipboard = (text: string, section: 'workflow' | 'planner') => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col overflow-y-auto transition-colors p-4 md:p-6 space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-sans tracking-tight">
                Habit Tracker & Daily Planner
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Track daily routines, streaks, and GitHub Action issue planners
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSyncToDailyNote}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Append habits checklist into today's note"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loggedToNoteStatus || 'Log Habits to Today\'s Note'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Habit</span>
          </button>
        </div>
      </div>

      {/* 2. Today Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Today Progress */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
            <span>TODAY'S COMPLETION</span>
            <ListTodo className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 font-mono">
              {todayCompletedCount}/{habits.length}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              ({todayPercentage}%)
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${todayPercentage}%` }}
            />
          </div>
        </div>

        {/* Card 2: Top Active Streak */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
            <span>ACTIVE STREAKS</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 font-mono">
              {Math.max(...habits.map(h => calculateStreak(h.id)), 0)} days
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              Top Habit
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            Consistency is key to habit mastery
          </p>
        </div>

        {/* Card 3: Active Habit Count */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
            <span>HABIT ROUTINES</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 font-mono">
              {habits.length}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
              Routines
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            Configured in local workspace
          </p>
        </div>

        {/* Card 4: Date Quick Info */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
            <span>SELECTED DAY</span>
            <CalendarIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
            {selectedDateStr}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Click any cell below to toggle status
          </p>
        </div>
      </div>

      {/* 3. Weekly Habit Matrix Grid */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xs">
        {/* Table Controls Header */}
        <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 font-sans tracking-tight">
              Habit Completion Matrix
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-[11px] font-mono font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
            >
              Current Week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40">
                <th className="p-3 text-xs font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">
                  Habit / Routine
                </th>
                <th className="p-3 text-xs font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-24">
                  Streak
                </th>
                {weekDays.map(day => (
                  <th
                    key={day.dateStr}
                    onClick={() => setSelectedDateStr(day.dateStr)}
                    className={`p-2.5 text-center cursor-pointer transition-colors ${
                      day.isToday
                        ? 'bg-blue-50/80 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100/60 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase">
                      {day.dayName}
                    </div>
                    <div className="text-xs font-mono font-bold">
                      {day.dayNumber}
                    </div>
                  </th>
                ))}
                <th className="p-3 text-xs font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-12">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
              {habits.map(habit => {
                const streak = calculateStreak(habit.id);

                return (
                  <tr
                    key={habit.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Habit Name & Category */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${habit.color || 'bg-blue-500'} shrink-0`} />
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-gray-100 font-sans">
                            {habit.name}
                          </div>
                          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                            {habit.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Streak Badge */}
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-mono font-bold border border-amber-200/80 dark:border-amber-900">
                        <Flame className="w-3 h-3 fill-amber-400" />
                        <span>{streak}d</span>
                      </div>
                    </td>

                    {/* Week Days Checkboxes */}
                    {weekDays.map(day => {
                      const isDone = (completions[day.dateStr] || []).includes(habit.id);

                      return (
                        <td
                          key={day.dateStr}
                          className={`p-2.5 text-center transition-colors ${
                            day.isToday ? 'bg-blue-50/20 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleHabit(habit.id, day.dateStr)}
                            className="p-1 rounded hover:scale-110 active:scale-95 transition-transform focus:outline-none"
                            title={`Toggle ${habit.name} for ${day.dateStr}`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/80 mx-auto" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 mx-auto" />
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Delete Option */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete habit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. GitHub Issue & Automation Planner Section */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-xl p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Github className="w-6 h-6 text-blue-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold tracking-tight font-sans">
                GitHub Issues & Action Automation (Habit Tracker)
              </h3>
              <p className="text-xs text-gray-300 font-mono">
                Automate your daily issue creation & habit check-lists using GitHub Actions
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
            Zero SHA / Free Search
          </span>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed font-sans">
          Treat GitHub Issues as rows for habits and daily planners! Every issue body holds checkbox items.
          Ticking a box marks a habit complete, while a GitHub Action runs automatically on a cron schedule to create your daily planner.
        </p>

        {/* Code Blocks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Workflow YAML */}
          <div className="bg-gray-950 rounded-lg p-3.5 border border-gray-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>.github/workflows/daily-planner.yml</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(yamlWorkflowCode, 'workflow')}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[11px] font-semibold text-gray-200 transition-colors flex items-center gap-1"
              >
                {copiedSection === 'workflow' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy YAML</span>
                  </>
                )}
              </button>
            </div>

            <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto p-2 bg-black/40 rounded border border-gray-800 leading-relaxed">
              {yamlWorkflowCode}
            </pre>
          </div>

          {/* PLANNER.md Template */}
          <div className="bg-gray-950 rounded-lg p-3.5 border border-gray-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <div className="flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-blue-400" />
                <span>.github/PLANNER.md</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(plannerMdTemplate, 'planner')}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[11px] font-semibold text-gray-200 transition-colors flex items-center gap-1"
              >
                {copiedSection === 'planner' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy PLANNER.md</span>
                  </>
                )}
              </button>
            </div>

            <pre className="text-[11px] font-mono text-blue-200 overflow-x-auto p-2 bg-black/40 rounded border border-gray-800 leading-relaxed max-h-[140px]">
              {plannerMdTemplate}
            </pre>
          </div>
        </div>
      </div>

      {/* 5. Add New Habit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 font-sans">
              Add New Habit Routine
            </h3>

            <form onSubmit={handleAddHabit} className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Habit Name
                </label>
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="e.g. Drink 2L Water"
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Category
                </label>
                <select
                  value={newHabitCategory}
                  onChange={(e) => setNewHabitCategory(e.target.value as Habit['category'])}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                >
                  <option value="Productivity">Productivity</option>
                  <option value="Health">Health</option>
                  <option value="Mindfulness">Mindfulness</option>
                  <option value="Learning">Learning</option>
                  <option value="Routine">Routine</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Create Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
