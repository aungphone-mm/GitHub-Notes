import { AppConfig } from '../types';

const CONFIG_KEY = 'gh_notes_config_v1';

export const defaultConfig: AppConfig = {
  owner: '',
  repo: '',
  branch: 'main',
  notesFolder: 'notes',
  token: ''
};

class SafeStorage {
  private memoryStore: Record<string, string> = {};

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return this.memoryStore[key] ?? null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      this.memoryStore[key] = value;
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      delete this.memoryStore[key];
    }
  }

  loadConfig(): AppConfig {
    const raw = this.getItem(CONFIG_KEY);
    if (!raw) return { ...defaultConfig };
    try {
      const parsed = JSON.parse(raw);
      return {
        owner: parsed.owner || '',
        repo: parsed.repo || '',
        branch: parsed.branch || 'main',
        notesFolder: parsed.notesFolder || 'notes',
        token: parsed.token || '',
        geminiKey: parsed.geminiKey || ''
      };
    } catch {
      return { ...defaultConfig };
    }
  }

  saveConfig(config: AppConfig): void {
    this.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  clearToken(): void {
    const current = this.loadConfig();
    current.token = '';
    this.saveConfig(current);
  }
}

export const safeStore = new SafeStorage();
