import { titleFromPath } from './slug';

export interface ParsedFrontmatter {
  title: string;
  tags: string[];
  updated: string;
  body: string;
}

export function serializeNoteContent(title: string, tags: string[], body: string): string {
  const isoUpdated = new Date().toISOString();
  const jsonTitle = JSON.stringify(title || 'Untitled');
  const formattedTags = tags.map(t => t.trim()).filter(Boolean);
  const jsonTags = JSON.stringify(formattedTags);

  const frontmatter = [
    '---',
    `title: ${jsonTitle}`,
    `tags: ${jsonTags}`,
    `updated: "${isoUpdated}"`,
    '---',
    '',
    body.trimStart()
  ].join('\n');

  return frontmatter;
}

export function parseNoteContent(rawContent: string, path: string): ParsedFrontmatter {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = normalized.match(frontmatterRegex);

  if (!match) {
    // No frontmatter found -> fallback title from path
    return {
      title: titleFromPath(path),
      tags: [],
      updated: '',
      body: rawContent
    };
  }

  const [, yamlBlock, body] = match;
  let title = titleFromPath(path);
  let tags: string[] = [];
  let updated = '';

  const lines = yamlBlock.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'title') {
      try {
        title = JSON.parse(value);
      } catch {
        title = value.replace(/^["']|["']$/g, '');
      }
    } else if (key === 'tags') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          tags = parsed.map(String);
        }
      } catch {
        // Fallback for simple comma list or unquoted list
        const clean = value.replace(/^\[|\]$/g, '');
        tags = clean.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    } else if (key === 'updated') {
      updated = value.replace(/^["']|["']$/g, '');
    }
  }

  return {
    title: title || titleFromPath(path),
    tags,
    updated,
    body: body.trim()
  };
}
