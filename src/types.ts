export interface AppConfig {
  owner: string;
  repo: string;
  branch: string;
  notesFolder: string;
  token: string;
  /**
   * Optional Gemini API key for direct calls. Last in the provider chain —
   * ignored when aiProxyUrl or openrouterKey is set.
   */
  geminiKey?: string;
  /**
   * Base URL of the Gemini proxy worker (see `worker/`). Set this where Gemini
   * is geo-blocked — requests route through the worker instead of the browser
   * calling Google directly, and the API key stays server-side. First in the
   * provider chain: deploying a worker is deliberate, so it wins over the keys.
   */
  aiProxyUrl?: string;
  /** Shared secret the proxy worker requires (its PROXY_KEY). */
  aiProxyKey?: string;
  /**
   * Optional OpenRouter API key. A second way around a Gemini geo-block that
   * needs nothing deployed: OpenRouter calls the model from its own servers.
   * Used when aiProxyUrl is not set. Get one at https://openrouter.ai/keys.
   */
  openrouterKey?: string;
}

/**
 * The main workspace panes, as picked from the sidebar nav.
 *
 * 'timeline' is the List View. It is deliberately not called 'list': App's
 * mobile sub-tab already uses 'list' for "show the NoteList sidebar", and it is
 * that tab's initial value — reusing the name would make the List View either
 * unreachable or the mobile landing screen, depending on branch order.
 */
export type ViewKey = 'editor' | 'timeline' | 'calendar' | 'habits';

export interface NoteHeader {
  path: string;
  sha: string;
  name: string;
  size?: number;
  updatedAt?: string;
  title?: string;
  tags?: string[];
  isDaily?: boolean;
  content?: string;
  isFavorite?: boolean;
}

export interface NoteDetail {
  path: string;
  sha: string;
  title: string;
  tags: string[];
  content: string;
  updated: string;
  /** Raw file content including frontmatter. Optional — absent for unsaved/new notes. */
  rawContent?: string;
  isPublic?: boolean;
}

export interface CommitNode {
  id: string;
  sha: string;
  shortSha: string;
  message: string;
  timestamp: string;
  path: string;
  action: 'add' | 'update' | 'append' | 'delete';
}

export interface StatusState {
  type: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  message: string;
  detail?: string;
}

export interface Habit {
  id: string;
  name: string;
  category: 'Productivity' | 'Health' | 'Mindfulness' | 'Learning' | 'Routine';
  icon?: string;
  color?: string;
  targetPerWeek?: number;
}

export type HabitCompletions = Record<string, string[]>; // dateStr ('YYYY-MM-DD') -> array of habit IDs completed

/**
 * Shape of the habits file committed to the repository.
 * `updatedAt` is the ISO timestamp of the last local edit and decides
 * which side wins when a browser and the repository disagree.
 */
export interface HabitData {
  version: number;
  habits: Habit[];
  completions: HabitCompletions;
  updatedAt: string;
}

export type HabitSyncState = 'offline' | 'loading' | 'saving' | 'synced' | 'error';

export interface IssueLabel {
  name: string;
  color: string;
}

/**
 * A repository issue rendered as a row in the planner table.
 * `checklistDone` / `checklistTotal` come from the task list in the issue body.
 */
export interface IssueRow {
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  labels: IssueLabel[];
  comments: number;
  updatedAt: string;
  checklistDone: number;
  checklistTotal: number;
}

