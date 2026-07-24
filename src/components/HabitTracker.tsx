import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Habit, HabitCompletions, NoteHeader } from '../types';
import { safeStore } from '../lib/storage';
import {
  CheckCircle2,
  Circle,
  Plus,
  Flame,
  Check,
  X,
  Copy,
  ListTodo,
  TrendingUp,
  FileCode,
  Github,
  RefreshCw,
  Bot
} from 'lucide-react';

interface HabitTrackerProps {
  notes?: NoteHeader[];
  selectedPath?: string | null;
  onAppendToDailyNote?: (contentToAppend: string) => void;
  onNewNoteForDate?: (dateStr: string) => void;
}

const HABITS_STORAGE_KEY = 'gh_notes_habits_v2';
const COMPLETIONS_STORAGE_KEY = 'gh_notes_habit_completions_v2';

const DEFAULT_HABITS: Habit[] = [
  {
    id: 'h1',
    name: '🎯 Top-1 Priority Focus Session',
    category: 'Productivity',
    color: 'bg-blue-500',
    targetPerWeek: 7
  },
  {
    id: 'h2',
    name: '⚡ Morning Exercise & Hydration',
    category: 'Health',
    color: 'bg-amber-500',
    targetPerWeek: 7
  },
  {
    id: 'h3',
    name: '📚 Read 15 Pages & Notes',
    category: 'Learning',
    color: 'bg-purple-500',
    targetPerWeek: 7
  },
  {
    id: 'h4',
    name: '🌙 Evening Habit Journal & Review',
    category: 'Mindfulness',
    color: 'bg-emerald-500',
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

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // New Habit Modal / Form
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  // Bot workflow modal toggle
  const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
  const [copiedSection, setCopiedSection] = useState<'workflow' | 'planner' | null>(null);
  const [postStatusMessage, setPostStatusMessage] = useState<string | null>(null);

  // Save to local storage on change
  useEffect(() => {
    safeStore.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    safeStore.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
  }, [completions]);

  // Generate 7 days ending today for the matrix header
  const matrixDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Array<{ dateStr: string; label: string; isToday: boolean; isYesterday: boolean }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const month = d.getMonth() + 1;
      const dayNum = d.getDate();

      let label = `${month}/${dayNum}`;
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Yest.';

      days.push({
        dateStr,
        label,
        isToday: i === 0,
        isYesterday: i === 1
      });
    }

    return days;
  }, []);

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

    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];

      const completed = (completions[dStr] || []).includes(habitId);
      if (completed) {
        streak++;
      } else {
        if (i === 0) continue; // Allow today to be incomplete without breaking current streak
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

  const longestStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map(h => calculateStreak(h.id)), 0);
  }, [habits, calculateStreak]);

  // Add Habit
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const newHabit: Habit = {
      id: `h_${Date.now()}`,
      name: newHabitName.trim(),
      category: 'Routine',
      color: 'bg-blue-500',
      targetPerWeek: 7
    };

    setHabits(prev => [...prev, newHabit]);
    setNewHabitName('');
    setIsAddModalOpen(false);
  };

  // Delete Habit
  const handleDeleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  // Post Issue Planner handler
  const handlePostIssuePlanner = () => {
    const todayList = completions[todayStr] || [];
    const markdownChecklist = habits
      .map(h => `- [${todayList.includes(h.id) ? 'x' : ' '}] ${h.name}`)
      .join('\n');

    const habitBlock = `\n\n### 🎯 Daily Habits & Planner (${todayStr})\n${markdownChecklist}\n`;

    if (onAppendToDailyNote) {
      onAppendToDailyNote(habitBlock);
      setPostStatusMessage('Planner Posted to Daily Note!');
      setTimeout(() => setPostStatusMessage(null), 3000);
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
- [ ] 09:00 - Morning Standup
- [ ] 11:00 - Deep Work Session
- [ ] 14:00 - Code Review & Pull Requests
- [ ] 17:00 - Evening Review & Reflection

## 📊 Habit Tracker
${habits.map(h => `- [ ] ${h.name}`).join('\n')}
`;

  const copyToClipboard = (text: string, section: 'workflow' | 'planner') => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  return (
    <div className="w-full h-full bg-[#f4f6f9] dark:bg-gray-950 flex flex-col overflow-y-auto transition-colors p-4 md:p-6 space-y-5">
      
      {/* 1. Top Row: 4 White KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Daily Completion */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/80 dark:border-gray-800 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-gray-400 uppercase font-sans">
            DAILY COMPLETION
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-gray-100 tracking-tight font-sans">
            {todayPercentage}%
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            {todayCompletedCount} of {habits.length} habits completed today
          </div>
        </div>

        {/* Card 2: Active Habits */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/80 dark:border-gray-800 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-gray-400 uppercase font-sans">
            ACTIVE HABITS
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-gray-100 tracking-tight font-sans">
            {habits.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Tracked daily
          </div>
        </div>

        {/* Card 3: Longest Streak */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/80 dark:border-gray-800 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-gray-400 uppercase font-sans">
            LONGEST STREAK
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-gray-100 tracking-tight font-sans flex items-center gap-1.5">
            <span className="text-2xl">🔥</span>
            <span>{longestStreak} days</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Consecutive completion
          </div>
        </div>

        {/* Card 4: GitHub Planner Issues */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/80 dark:border-gray-800 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-gray-400 uppercase font-sans">
            GITHUB PLANNER ISSUES
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-gray-100 tracking-tight font-sans">
            {todayCompletedCount > 0 ? '1' : '0'}
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Sync with GitHub
          </div>
        </div>
      </div>

      {/* 2. Today's Habit Checklist & Daily Planner Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-2xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center gap-1.5 font-sans">
              <span className="text-emerald-600 dark:text-emerald-400">✅</span>
              <span>Today's Habit Checklist & Daily Planner</span>
            </h2>
            <span className="bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded tracking-wide uppercase">
              TODAY
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
            >
              + Custom Habit
            </button>

            <button
              type="button"
              onClick={handlePostIssuePlanner}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs"
            >
              {postStatusMessage || 'Post Issue Planner'}
            </button>
          </div>
        </div>

        {/* Habit Cards List */}
        <div className="space-y-2.5">
          {habits.map(habit => {
            const isCompleted = (completions[todayStr] || []).includes(habit.id);
            const streak = calculateStreak(habit.id);

            return (
              <div
                key={habit.id}
                className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-2xs"
              >
                {/* Left: Checkbox + Title */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => toggleHabit(habit.id, todayStr)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span
                    onClick={() => toggleHabit(habit.id, todayStr)}
                    className={`text-sm font-semibold cursor-pointer select-none transition-colors ${
                      isCompleted
                        ? 'line-through text-slate-400 dark:text-gray-500'
                        : 'text-slate-800 dark:text-gray-100'
                    }`}
                  >
                    {habit.name}
                  </span>
                </div>

                {/* Right: Streak Badge + Remove button */}
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100/80 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1 font-sans">
                    <span>🔥</span>
                    <span>{streak}d streak</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteHabit(habit.id)}
                    className="p-1 rounded text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 border border-gray-200 dark:border-gray-800 hover:border-rose-300 dark:hover:border-rose-900 transition-colors"
                    title="Remove habit"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 7-Day Completion Matrix & Streaks Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-2xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2 font-sans">
            <span>📊</span>
            <span>7-Day Completion Matrix & Streaks</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Click table cells to toggle completion history
          </span>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-gray-800/80 text-slate-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800 font-sans text-xs">
                <th className="p-3 font-bold w-1/3 text-slate-700 dark:text-gray-300 text-center sm:text-left">
                  Habit Name
                </th>
                {matrixDays.map(day => (
                  <th
                    key={day.dateStr}
                    className="p-3 font-bold text-center text-slate-700 dark:text-gray-300 w-16"
                  >
                    {day.label}
                  </th>
                ))}
                <th className="p-3 font-bold text-center text-slate-700 dark:text-gray-300 w-28">
                  Current Streak
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs font-sans">
              {habits.map(habit => {
                const streak = calculateStreak(habit.id);

                return (
                  <tr
                    key={habit.id}
                    className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Habit Name */}
                    <td className="p-3 font-semibold text-slate-800 dark:text-gray-200">
                      {habit.name}
                    </td>

                    {/* Days matrix cells */}
                    {matrixDays.map(day => {
                      const isDone = (completions[day.dateStr] || []).includes(habit.id);

                      return (
                        <td
                          key={day.dateStr}
                          onClick={() => toggleHabit(habit.id, day.dateStr)}
                          className="p-3 text-center cursor-pointer select-none hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        >
                          {isDone ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-600">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Current Streak */}
                    <td className="p-3 text-center font-bold text-slate-800 dark:text-gray-200">
                      <div className="inline-flex items-center gap-1">
                        <span>🔥</span>
                        <span>{streak}d</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. GitHub Issues Planner ("Issues as Rows") Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-2xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2 font-sans">
            <span>📌</span>
            <span>GitHub Issues Planner ("Issues as Rows")</span>
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPostStatusMessage('Issues Refreshed!');
                setTimeout(() => setPostStatusMessage(null), 2000);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Fetch Issues</span>
            </button>

            <button
              type="button"
              onClick={() => setShowWorkflowConfig(!showWorkflowConfig)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Bot Workflow Config</span>
            </button>
          </div>
        </div>

        {/* Info Banner / Workflow Preview */}
        {showWorkflowConfig ? (
          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 border-b border-gray-800 pb-2">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>.github/workflows/daily-planner.yml & .github/PLANNER.md</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(yamlWorkflowCode, 'workflow')}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[11px] text-gray-200 flex items-center gap-1"
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

            <pre className="text-xs font-mono text-emerald-300 overflow-x-auto p-3 bg-black/60 rounded border border-gray-800 leading-relaxed">
              {yamlWorkflowCode}
            </pre>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/80 dark:border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                <Github className="w-4 h-4 text-slate-700 dark:text-gray-300" />
                <span>Daily Planner Issue Automation</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Each note is stored as a GitHub issue. Labels act as tags, comments are journal logs, and a GitHub Action opens your daily planner automatically on a cron schedule!
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                label: note
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                label: habit-tracker
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Add New Custom Habit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 font-sans">
              Add New Custom Habit
            </h3>

            <form onSubmit={handleAddHabit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1 font-sans">
                  Habit Name & Emoji
                </label>
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="e.g. 🚴 30-min Cycling Session"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-gray-100"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
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

