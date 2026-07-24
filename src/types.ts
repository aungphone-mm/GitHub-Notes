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
