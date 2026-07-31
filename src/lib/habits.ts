import { Habit, HabitCompletions, HabitData } from '../types';
import { safeStore } from './storage';

export const HABIT_DATA_VERSION = 1;

// Kept at the v2 keys so habits created before syncing existed are picked up
// on first load and pushed to the repository instead of being discarded.
const HABITS_STORAGE_KEY = 'gh_notes_habits_v2';
const COMPLETIONS_STORAGE_KEY = 'gh_notes_habit_completions_v2';
const META_STORAGE_KEY = 'gh_notes_habits_meta_v1';

const VALID_CATEGORIES: Habit['category'][] = [
  'Productivity',
  'Health',
  'Mindfulness',
  'Learning',
  'Routine'
];

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const EPOCH_ISO = new Date(0).toISOString();

/**
 * The YYYY-MM-DD key a date is filed under, in the viewer's own timezone.
 *
 * Deliberately local rather than `toISOString().slice(0, 10)`: a habit is about
 * the user's day, and east-of-UTC users would otherwise file anything ticked
 * before their morning UTC rollover under the previous day. Both the tracker
 * and the calendar must call this, or a completion is written under one key and
 * looked up under another.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Habit ids completed on a given date, filtered to habits that still exist.
 * Deleting a habit leaves its id behind in history; counting those would show
 * completions above the number of tracked habits.
 */
export function completedOn(
  completions: HabitCompletions,
  dateStr: string,
  habits: Habit[]
): string[] {
  const done = completions[dateStr];
  if (!done || done.length === 0) return [];

  const known = new Set(habits.map(h => h.id));
  return done.filter(id => known.has(id));
}

export const DEFAULT_HABITS: Habit[] = [
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

export interface HabitMeta {
  updatedAt: string;
  remoteSha: string | null;
}

function normalizeHabits(raw: unknown): Habit[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const habits: Habit[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);

    const category = VALID_CATEGORIES.includes(candidate.category as Habit['category'])
      ? (candidate.category as Habit['category'])
      : 'Routine';

    habits.push({
      id,
      name,
      category,
      icon: typeof candidate.icon === 'string' ? candidate.icon : undefined,
      color: typeof candidate.color === 'string' ? candidate.color : 'bg-blue-500',
      targetPerWeek:
        typeof candidate.targetPerWeek === 'number' && Number.isFinite(candidate.targetPerWeek)
          ? candidate.targetPerWeek
          : 7
    });
  }

  return habits;
}

function normalizeCompletions(raw: unknown): HabitCompletions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const completions: HabitCompletions = {};

  for (const [dateStr, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!DATE_KEY_PATTERN.test(dateStr) || !Array.isArray(ids)) continue;

    const cleaned = Array.from(
      new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );

    // Drop empty days so the committed file stays small over time.
    if (cleaned.length > 0) {
      completions[dateStr] = cleaned;
    }
  }

  return completions;
}

/**
 * Coerce anything (remote JSON, stale local storage) into usable habit data.
 * Never throws — malformed pieces are dropped rather than blocking the app.
 */
export function normalizeHabitData(raw: unknown): HabitData {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  return {
    version: HABIT_DATA_VERSION,
    habits: normalizeHabits(source.habits),
    completions: normalizeCompletions(source.completions),
    updatedAt:
      typeof source.updatedAt === 'string' && !Number.isNaN(Date.parse(source.updatedAt))
        ? new Date(source.updatedAt).toISOString()
        : EPOCH_ISO
  };
}

export function loadLocalMeta(): HabitMeta {
  const raw = safeStore.getItem(META_STORAGE_KEY);
  if (!raw) return { updatedAt: EPOCH_ISO, remoteSha: null };

  try {
    const parsed = JSON.parse(raw);
    return {
      updatedAt:
        typeof parsed.updatedAt === 'string' && !Number.isNaN(Date.parse(parsed.updatedAt))
          ? new Date(parsed.updatedAt).toISOString()
          : EPOCH_ISO,
      remoteSha: typeof parsed.remoteSha === 'string' ? parsed.remoteSha : null
    };
  } catch {
    return { updatedAt: EPOCH_ISO, remoteSha: null };
  }
}

export function saveLocalMeta(meta: HabitMeta): void {
  safeStore.setItem(META_STORAGE_KEY, JSON.stringify(meta));
}

export function loadLocalHabits(): Habit[] {
  const raw = safeStore.getItem(HABITS_STORAGE_KEY);
  if (!raw) return DEFAULT_HABITS;

  try {
    const habits = normalizeHabits(JSON.parse(raw));
    return habits.length > 0 ? habits : DEFAULT_HABITS;
  } catch {
    return DEFAULT_HABITS;
  }
}

export function loadLocalCompletions(): HabitCompletions {
  const raw = safeStore.getItem(COMPLETIONS_STORAGE_KEY);
  if (!raw) return {};

  try {
    return normalizeCompletions(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveLocalHabits(habits: Habit[]): void {
  safeStore.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
}

export function saveLocalCompletions(completions: HabitCompletions): void {
  safeStore.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
}

/**
 * True when the local copy has edits the repository has not seen yet.
 * ISO-8601 UTC strings compare correctly lexicographically.
 */
export function isLocalNewer(localUpdatedAt: string, remoteUpdatedAt: string): boolean {
  return localUpdatedAt > remoteUpdatedAt;
}
