import { AppConfig, NoteHeader, NoteDetail, HabitData, IssueRow } from '../types';
import { b64encode, b64decode } from './encoding';
import { parseNoteContent } from './frontmatter';
import { normalizeHabitData } from './habits';

export function encodePathSegments(path: string): string {
  return path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export class GitHubApiError extends Error {
  status: number;
  githubMessage?: string;

  constructor(status: number, message: string, githubMessage?: string) {
    super(message);
    this.status = status;
    this.githubMessage = githubMessage;
    this.name = 'GitHubApiError';
  }
}

/**
 * Core fetch helper adhering to required headers and error extraction.
 */
async function ghFetch(
  config: AppConfig,
  endpoint: string,
  options: RequestInit = {},
  allow404Null = false
): Promise<any> {
  // Validate configuration before making network requests
  if (!config.owner.trim()) {
    throw new GitHubApiError(400, 'Missing Repository Owner (e.g., username or organization)');
  }
  if (!config.repo.trim()) {
    throw new GitHubApiError(400, 'Missing Repository Name');
  }
  if (!config.token.trim()) {
    throw new GitHubApiError(400, 'Missing GitHub Personal Access Token');
  }

  const baseUrl = 'https://api.github.com';
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Authorization': `Bearer ${config.token.trim()}`,
    ...(options.headers as Record<string, string> || {})
  };

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err: any) {
    throw new GitHubApiError(0, `Network error: ${err.message || 'Failed to connect to GitHub'}`);
  }

  if (allow404Null && response.status === 404) {
    return null;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const ghMessage = data?.message || response.statusText;
    if (response.status === 409) {
      throw new GitHubApiError(
        409,
        'Conflict (409): The note was updated on GitHub. Please refresh to get the latest version.',
        ghMessage
      );
    }
    if (response.status === 401) {
      throw new GitHubApiError(
        401,
        'Unauthorized (401): Invalid or expired Personal Access Token.',
        ghMessage
      );
    }
    if (response.status === 404) {
      throw new GitHubApiError(
        404,
        `Not Found (404): ${ghMessage || 'Resource or path does not exist in repository.'}`,
        ghMessage
      );
    }
    throw new GitHubApiError(
      response.status,
      `GitHub API Error (${response.status}): ${ghMessage}`,
      ghMessage
    );
  }

  return data;
}

/**
 * List all notes in the configured folder via recursive tree call.
 * Uses single GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
 */
export async function listNotes(config: AppConfig): Promise<NoteHeader[]> {
  const branch = encodeURIComponent(config.branch || 'main');
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/trees/${branch}?recursive=1`;

  const data = await ghFetch(config, endpoint);

  if (!data || !Array.isArray(data.tree)) {
    return [];
  }

  let folderPrefix = (config.notesFolder || 'notes').trim();
  // Strip leading and trailing slashes from folderPrefix
  folderPrefix = folderPrefix.replace(/^\/+|\/+$/g, '');

  const notes: NoteHeader[] = [];

  for (const item of data.tree) {
    if (item.type !== 'blob') continue;
    if (!item.path.endsWith('.md')) continue;

    const itemPath = item.path as string;

    // Check if item path is inside configured folder
    let isMatch = false;
    if (!folderPrefix) {
      isMatch = true; // root folder mode
    } else if (itemPath.startsWith(folderPrefix + '/')) {
      isMatch = true;
    }

    if (!isMatch) continue;

    const isDaily = itemPath.includes(`${folderPrefix}/daily/`) || itemPath.startsWith('daily/');
    const pathParts = itemPath.split('/');
    const filename = pathParts[pathParts.length - 1];

    notes.push({
      path: itemPath,
      sha: item.sha,
      name: filename,
      size: item.size,
      isDaily
    });
  }

  // Sort newest path first
  notes.sort((a, b) => b.path.localeCompare(a.path));

  return notes;
}

/**
 * Read note contents and decode UTF-8 markdown + parse frontmatter.
 */
export async function readNote(config: AppConfig, path: string): Promise<NoteDetail> {
  const encodedPath = encodePathSegments(path);
  const branch = encodeURIComponent(config.branch || 'main');
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${branch}`;

  const data = await ghFetch(config, endpoint);

  if (!data || !data.content) {
    throw new GitHubApiError(500, `Empty content returned for file: ${path}`);
  }

  const rawContent = b64decode(data.content);
  const parsed = parseNoteContent(rawContent, path);

  return {
    path: data.path || path,
    sha: data.sha,
    title: parsed.title,
    tags: parsed.tags,
    content: parsed.body,
    updated: parsed.updated,
    rawContent,
    isPublic: parsed.isPublic
  };
}

/**
 * Save / Update a note with commit message.
 */
export async function saveNote(
  config: AppConfig,
  path: string,
  rawMarkdownContent: string,
  existingSha?: string,
  isNew: boolean = false
): Promise<{ sha: string; commitSha?: string; commitMessage: string }> {
  const encodedPath = encodePathSegments(path);
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;

  const filename = path.split('/').pop() || path;
  const actionText = isNew ? 'add' : 'update';
  const commitMessage = `note: ${actionText} ${filename}`;

  const base64Content = b64encode(rawMarkdownContent);

  const body: any = {
    message: commitMessage,
    content: base64Content,
    branch: config.branch || 'main'
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await ghFetch(config, endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    sha: res.content.sha,
    commitSha: res.commit?.sha,
    commitMessage
  };
}

/**
 * Append text to today's daily log.
 * Reads notes/daily/YYYY-MM-DD.md (404 starts new file with # YYYY-MM-DD),
 * appends ## HH:MM plus text, commits, and returns.
 */
export async function appendToDailyLog(
  config: AppConfig,
  textToAppend: string
): Promise<{ path: string; sha: string; commitSha?: string; commitMessage: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${mins}`;

  let folderPrefix = (config.notesFolder || 'notes').trim().replace(/^\/+|\/+$/g, '');
  const dailyPath = folderPrefix ? `${folderPrefix}/daily/${todayStr}.md` : `daily/${todayStr}.md`;

  const encodedPath = encodePathSegments(dailyPath);
  const branch = encodeURIComponent(config.branch || 'main');
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;

  // Read existing daily file with allow404Null = true
  const existingFile = await ghFetch(config, `${endpoint}?ref=${branch}`, {}, true);

  let updatedContent = '';
  let existingSha: string | undefined = undefined;

  if (!existingFile) {
    // 404 tolerated -> start a new file
    updatedContent = `# ${todayStr}\n\n## ${timeStr}\n\n${textToAppend.trim()}\n`;
  } else {
    existingSha = existingFile.sha;
    const currentText = b64decode(existingFile.content);
    const cleanCurrent = currentText.trimEnd();
    updatedContent = `${cleanCurrent}\n\n## ${timeStr}\n\n${textToAppend.trim()}\n`;
  }

  const commitMessage = `note: append to daily log ${todayStr}`;
  const base64Content = b64encode(updatedContent);

  const body: any = {
    message: commitMessage,
    content: base64Content,
    branch: config.branch || 'main'
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await ghFetch(config, endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    path: dailyPath,
    sha: res.content.sha,
    commitSha: res.commit?.sha,
    commitMessage
  };
}

/**
 * Delete a note from repository.
 */
export async function deleteNote(
  config: AppConfig,
  path: string,
  sha?: string
): Promise<{ commitSha?: string; commitMessage: string }> {
  let fileSha = sha;
  const encodedPath = encodePathSegments(path);
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;
  const branch = encodeURIComponent(config.branch || 'main');

  if (!fileSha) {
    const existingFile = await ghFetch(config, `${endpoint}?ref=${branch}`);
    if (existingFile && existingFile.sha) {
      fileSha = existingFile.sha;
    } else {
      throw new GitHubApiError(404, 'Could not locate note on repository to delete.');
    }
  }

  const filename = path.split('/').pop() || path;
  const commitMessage = `note: delete ${filename}`;

  const body = {
    message: commitMessage,
    sha: fileSha,
    branch: config.branch || 'main'
  };

  const res = await ghFetch(config, endpoint, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    commitSha: res.commit?.sha,
    commitMessage
  };
}

/**
 * Repository path of the habits file, e.g. "notes/habits.json".
 */
export function habitsFilePath(config: AppConfig): string {
  const folderPrefix = (config.notesFolder || 'notes').trim().replace(/^\/+|\/+$/g, '');
  return folderPrefix ? `${folderPrefix}/habits.json` : 'habits.json';
}

/**
 * Read habits + completions from the repository.
 * Returns null when the file does not exist yet (first sync from this repo).
 */
export async function readHabitData(
  config: AppConfig
): Promise<{ data: HabitData; sha: string; path: string } | null> {
  const path = habitsFilePath(config);
  const encodedPath = encodePathSegments(path);
  const branch = encodeURIComponent(config.branch || 'main');
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${branch}`;

  const file = await ghFetch(config, endpoint, {}, true);
  if (!file) return null;

  // Files over 1MB come back with an empty body and encoding "none".
  if (!file.content || file.encoding !== 'base64') {
    throw new GitHubApiError(
      500,
      `Habits file ${path} could not be read inline (encoding: ${file.encoding || 'unknown'}).`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(b64decode(file.content));
  } catch {
    throw new GitHubApiError(
      500,
      `Habits file ${path} is not valid JSON. Fix or delete it on GitHub to resume syncing.`
    );
  }

  return { data: normalizeHabitData(parsed), sha: file.sha, path };
}

/**
 * Commit habits + completions to the repository.
 * Pass the last known SHA so GitHub rejects a write over someone else's newer version.
 */
export async function writeHabitData(
  config: AppConfig,
  data: HabitData,
  existingSha?: string
): Promise<{ sha: string; commitSha?: string; commitMessage: string; path: string }> {
  const path = habitsFilePath(config);
  const encodedPath = encodePathSegments(path);
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;

  const commitMessage = `habits: sync ${data.habits.length} habit(s)`;
  const serialized = `${JSON.stringify(data, null, 2)}\n`;

  const body: any = {
    message: commitMessage,
    content: b64encode(serialized),
    branch: config.branch || 'main'
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await ghFetch(config, endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    sha: res.content.sha,
    commitSha: res.commit?.sha,
    commitMessage,
    path
  };
}

/**
 * Count "- [ ]" / "- [x]" task list items in an issue body.
 * Mirrors how GitHub itself renders task list progress.
 */
export function parseChecklistProgress(body: string | null | undefined): {
  done: number;
  total: number;
} {
  if (!body) return { done: 0, total: 0 };

  let done = 0;
  let total = 0;

  for (const line of body.split('\n')) {
    const match = /^\s*[-*]\s+\[([ xX])\]\s+/.exec(line);
    if (!match) continue;
    total++;
    if (match[1] !== ' ') done++;
  }

  return { done, total };
}

/**
 * List repository issues for the planner table.
 * Pull requests are filtered out: /issues returns them too, and they are not planner rows.
 */
export async function listIssues(
  config: AppConfig,
  options: { labels?: string; state?: 'open' | 'closed' | 'all'; perPage?: number } = {}
): Promise<IssueRow[]> {
  const { labels = '', state = 'open', perPage = 30 } = options;

  const params = new URLSearchParams({
    state,
    sort: 'updated',
    direction: 'desc',
    per_page: String(perPage)
  });

  const trimmedLabels = labels.trim();
  if (trimmedLabels) {
    params.set('labels', trimmedLabels);
  }

  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues?${params.toString()}`;
  const data = await ghFetch(config, endpoint);

  if (!Array.isArray(data)) return [];

  return data
    .filter((item: any) => item && !item.pull_request)
    .map((item: any): IssueRow => {
      const progress = parseChecklistProgress(item.body);

      return {
        number: item.number,
        title: item.title || '(untitled)',
        state: item.state === 'closed' ? 'closed' : 'open',
        htmlUrl: item.html_url,
        labels: Array.isArray(item.labels)
          ? item.labels
              .filter((l: any) => l && typeof l.name === 'string')
              .map((l: any) => ({ name: l.name, color: typeof l.color === 'string' ? l.color : '888888' }))
          : [],
        comments: typeof item.comments === 'number' ? item.comments : 0,
        updatedAt: item.updated_at || '',
        checklistDone: progress.done,
        checklistTotal: progress.total
      };
    });
}

/**
 * Search notes in repository using GitHub Code Search API (/search/code).
 */
export async function searchNotesCode(
  config: AppConfig,
  query: string
): Promise<{ path: string; name: string; sha: string; htmlUrl?: string }[]> {
  if (!query.trim()) return [];

  let folderPrefix = (config.notesFolder || 'notes').trim().replace(/^\/+|\/+$/g, '');
  let q = `${query.trim()} repo:${config.owner.trim()}/${config.repo.trim()} extension:md`;
  if (folderPrefix) {
    q += ` path:${folderPrefix}`;
  }

  const endpoint = `/search/code?q=${encodeURIComponent(q)}`;
  try {
    const data = await ghFetch(config, endpoint);

    if (!data || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((item: any) => ({
      path: item.path,
      name: item.name,
      sha: item.sha,
      htmlUrl: item.html_url
    }));
  } catch (err) {
    console.warn('GitHub /search/code query failed or unindexed repo:', err);
    throw err;
  }
}
