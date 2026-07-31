export interface AppConfig {
  owner: string;
  repo: string;
  branch: string;
  notesFolder: string;
  token: string;
}

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
  rawContent: string;
  isPublic: boolean;
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

