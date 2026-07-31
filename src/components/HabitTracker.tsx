import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppConfig, Habit, HabitCompletions, HabitData, HabitSyncState, NoteHeader } from '../types';
import {
  DEFAULT_HABITS,
  HABIT_DATA_VERSION,
  isLocalNewer,
  loadLocalCompletions,
  loadLocalHabits,
  loadLocalMeta,
  saveLocalCompletions,
  saveLocalHabits,
  saveLocalMeta
} from '../lib/habits';
import { GitHubApiError, habitsFilePath, readHabitData, writeHabitData } from '../lib/githubApi';
import {
  Check,
  X,
  Copy,
  CloudOff,
  Cloud,
  AlertTriangle,
  FileCode,
  Github,
  RefreshCw,
  Bot
} from 'lucide-react';

interface HabitTrackerProps {
  config: AppConfig;
  notes?: NoteHeader[];
  selectedPath?: string | null;
  onAppendToDailyNote?: (contentToAppend: string) => void;
  onNewNoteForDate?: (dateStr: string) => void;
  onCommit?: (sha: string, message: string, path: string) => void;
}

// Delay between the last edit and the commit, so rapid checkbox
// toggling produces one commit instead of one per click.
const PUSH_DEBOUNCE_MS = 1500;

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  config,
  onAppendToDailyNote,
  onNewNoteForDate,
  onCommit
}) => {
  // 1. Load State (local storage acts as the offline cache for the repo file)
  const [habits, setHabits] = useState<Habit[]>(() => loadLocalHabits());
  const [completions, setCompletions] = useState<HabitCompletions>(() => loadLocalCompletions());

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // New Habit Modal / Form
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  // Bot workflow modal toggle
  const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
  const [copiedSection, setCopiedSection] = useState<'workflow' | 'planner' | null>(null);
  const [postStatusMessage, setPostStatusMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // GitHub sync
  // ---------------------------------------------------------------------------
  const [syncState, setSyncState] = useState<HabitSyncState>('offline');
  const [syncMessage, setSyncMessage] = useState<string>('Habits are stored in this browser only.');

  const configReady = Boolean(config.owner && config.repo && config.token);
  const remotePath = useMemo(() => habitsFilePath(config), [config]);

  // Refs let the debounced push read current values without re-arming the timer.
  const habitsRef = useRef(habits);
  const completionsRef = useRef(completions);
  const remoteShaRef = useRef<string | null>(loadLocalMeta().remoteSha);
  const localUpdatedAtRef = useRef<string>(loadLocalMeta().updatedAt);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const pullInFlightRef = useRef(false);

  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  useEffect(() => {
    completionsRef.current = completions;
  }, [completions]);

  useEffect(() => {
    // Set on mount rather than only at ref creation: StrictMode's simulated
    // remount runs the cleanup while keeping refs, which would otherwise leave
    // this false forever and swallow every post-await state update.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  // Save to local storage on change
  useEffect(() => {
    saveLocalHabits(habits);
  }, [habits]);

  useEffect(() => {
    saveLocalCompletions(completions);
  }, [completions]);

  const snapshot = useCallback((updatedAt: string): HabitData => ({
    version: HABIT_DATA_VERSION,
    habits: habitsRef.current,
    completions: completionsRef.current,
    updatedAt
  }), []);

  const describeError = (err: unknown): string =>
    err instanceof GitHubApiError
      ? err.message
      : (err as Error)?.message || 'Unknown error while syncing habits';

  const pushToGitHub = useCallback(async (data: HabitData, isRetry = false): Promise<void> => {
    if (!configReady) {
      setSyncState('offline');
      setSyncMessage('Saved in this browser. Connect a repository to sync habits.');
      return;
    }

    setSyncState('saving');
    setSyncMessage(`Committing habits to ${remotePath}...`);

    try {
      const res = await writeHabitData(config, data, remoteShaRef.current ?? undefined);

      remoteShaRef.current = res.sha;
      localUpdatedAtRef.current = data.updatedAt;
      saveLocalMeta({ updatedAt: data.updatedAt, remoteSha: res.sha });
      onCommit?.(res.commitSha || res.sha, res.commitMessage, res.path);

      if (!isMountedRef.current) return;
      setSyncState('synced');
      setSyncMessage(`Synced to ${res.path} (${(res.commitSha || res.sha).substring(0, 7)})`);
    } catch (err) {
      // A stale or missing SHA means the file moved underneath us: pick up the
      // current one and write once more. Last edit wins.
      const status = err instanceof GitHubApiError ? err.status : -1;
      if (!isRetry && (status === 409 || status === 422 || status === 404)) {
        try {
          const remote = await readHabitData(config);
          remoteShaRef.current = remote?.sha ?? null;
          await pushToGitHub(data, true);
          return;
        } catch (retryErr) {
          if (!isMountedRef.current) return;
          setSyncState('error');
          setSyncMessage(describeError(retryErr));
          return;
        }
      }

      if (!isMountedRef.current) return;
      setSyncState('error');
      setSyncMessage(describeError(err));
    }
  }, [config, configReady, onCommit, remotePath]);

  const pullFromGitHub = useCallback(async (): Promise<void> => {
    if (!configReady) {
      setSyncState('offline');
      setSyncMessage('Saved in this browser. Connect a repository to sync habits.');
      return;
    }

    // Overlapping pulls would race on the SHA and can double-commit the
    // "create the file" path (StrictMode mounts effects twice in dev).
    if (pullInFlightRef.current) return;
    pullInFlightRef.current = true;

    setSyncState('loading');
    setSyncMessage(`Loading habits from ${remotePath}...`);

    try {
      const remote = await readHabitData(config);
      const local = snapshot(localUpdatedAtRef.current);

      // No file yet: seed the repository from whatever this browser already has,
      // so habits created before syncing existed are preserved rather than lost.
      if (!remote) {
        remoteShaRef.current = null;
        await pushToGitHub({ ...local, updatedAt: new Date().toISOString() });
        return;
      }

      remoteShaRef.current = remote.sha;

      if (isLocalNewer(local.updatedAt, remote.data.updatedAt)) {
        await pushToGitHub(local);
        return;
      }

      if (!isMountedRef.current) return;
      setHabits(remote.data.habits.length > 0 ? remote.data.habits : DEFAULT_HABITS);
      setCompletions(remote.data.completions);
      localUpdatedAtRef.current = remote.data.updatedAt;
      saveLocalMeta({ updatedAt: remote.data.updatedAt, remoteSha: remote.sha });

      setSyncState('synced');
      setSyncMessage(
        `Loaded ${remote.data.habits.length} habit(s) from ${remote.path} (${remote.sha.substring(0, 7)})`
      );
    } catch (err) {
      if (!isMountedRef.current) return;
      setSyncState('error');
      setSyncMessage(describeError(err));
    } finally {
      pullInFlightRef.current = false;
    }
  }, [config, configReady, pushToGitHub, remotePath, snapshot]);

  // Pull whenever the repository target changes (including the initial connect).
  useEffect(() => {
    if (!configReady) {
      setSyncState('offline');
      setSyncMessage('Saved in this browser. Connect a repository to sync habits.');
      return;
    }
    pullFromGitHub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configReady, config.owner, config.repo, config.branch, config.notesFolder, config.token]);

  /**
   * Called after every local edit: stamps the change and schedules one commit.
   */
  const markLocalChange = useCallback(() => {
    const updatedAt = new Date().toISOString();
    localUpdatedAtRef.current = updatedAt;
    saveLocalMeta({ updatedAt, remoteSha: remoteShaRef.current });

    if (!configReady) {
      setSyncState('offline');
      setSyncMessage('Saved in this browser. Connect a repository to sync habits.');
      return;
    }

    setSyncState('saving');
    setSyncMessage('Pending commit...');

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushToGitHub(snapshot(localUpdatedAtRef.current));
    }, PUSH_DEBOUNCE_MS);
  }, [configReady, pushToGitHub, snapshot]);

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
    markLocalChange();
  }, [markLocalChange]);

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
    markLocalChange();
  };

  // Delete Habit
  const handleDeleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    markLocalChange();
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

  // Sync status pill presentation
  const syncPill = useMemo(() => {
    switch (syncState) {
      case 'loading':
        return {
          label: 'Loading...',
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
          className:
            'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
      case 'saving':
        return {
          label: 'Syncing...',
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
          className:
            'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
      case 'synced':
        return {
          label: 'Synced',
          icon: <Cloud className="w-3.5 h-3.5" />,
          className:
            'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        };
      case 'error':
        return {
          label: 'Sync failed',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          className:
            'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        };
      default:
        return {
          label: 'Local only',
          icon: <CloudOff className="w-3.5 h-3.5" />,
          className:
            'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-gray-300 dark:border-gray-700'
        };
    }
  }, [syncState]);

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
              onClick={() => pullFromGitHub()}
              disabled={!configReady || syncState === 'loading' || syncState === 'saving'}
              title={syncMessage}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-70 ${syncPill.className}`}
            >
              {syncPill.icon}
              <span>{syncPill.label}</span>
            </button>

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

        {/* Sync detail line */}
        <div
          className={`text-[11px] font-mono px-3 py-2 rounded-lg border ${
            syncState === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
              : 'bg-slate-50 dark:bg-gray-800/50 text-slate-500 dark:text-gray-400 border-gray-200 dark:border-gray-800'
          }`}
        >
          {syncMessage}
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

