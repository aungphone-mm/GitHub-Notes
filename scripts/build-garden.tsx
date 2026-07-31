import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseNoteContent } from '../src/lib/frontmatter';
import { slugify, titleFromPath } from '../src/lib/slug';
import { MarkdownViewer } from '../src/components/MarkdownViewer';

// Mirrors the base path vite.config.ts uses for the main app build.
const BASE = process.env.GITHUB_PAGES === 'true' ? '/GitHub-Notes1/' : '/';
const REPO_ROOT = process.cwd();
const NOTES_FOLDER = (process.env.GARDEN_NOTES_FOLDER || 'notes').replace(/^\/+|\/+$/g, '');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const GARDEN_DIR = path.join(DIST_DIR, 'garden');

interface GardenNote {
  path: string;
  slug: string;
  title: string;
  tags: string[];
  updated: string;
  body: string;
}

function findMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function loadPublicNotes(): GardenNote[] {
  const notesDir = NOTES_FOLDER ? path.join(REPO_ROOT, NOTES_FOLDER) : REPO_ROOT;
  const files = findMarkdownFiles(notesDir);
  const usedSlugs = new Set<string>();
  const notes: GardenNote[] = [];

  for (const file of files) {
    const relPath = path.relative(REPO_ROOT, file);
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = parseNoteContent(raw, relPath);
    if (!parsed.isPublic) continue;

    let slug = slugify(parsed.title || titleFromPath(relPath));
    while (usedSlugs.has(slug)) {
      slug = `${slug}-${usedSlugs.size}`;
    }
    usedSlugs.add(slug);

    notes.push({
      path: relPath,
      slug,
      title: parsed.title || titleFromPath(relPath),
      tags: parsed.tags,
      updated: parsed.updated,
      body: parsed.body
    });
  }

  // Newest first; notes without an `updated` timestamp sort last.
  notes.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  return notes;
}

function findBuiltStylesheetHref(): string {
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`${indexHtmlPath} not found. Run "vite build" before building the garden.`);
  }
  const html = fs.readFileSync(indexHtmlPath, 'utf-8');
  const match = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/);
  if (!match) {
    throw new Error('Could not find a built stylesheet link in dist/index.html.');
  }
  return match[1];
}

function pageShell(title: string, bodyHtml: string, stylesheetHref: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" crossorigin href="${stylesheetHref}">
  </head>
  <body class="bg-[#f4f5f7] text-[#1c2024] antialiased min-h-screen dark:bg-gray-950 dark:text-gray-100">
    <div class="max-w-2xl mx-auto px-4 py-8">
${bodyHtml}
    </div>
  </body>
</html>
`;
}

function renderIndexPage(notes: GardenNote[], stylesheetHref: string): string {
  const listHtml = notes.length
    ? notes
        .map(
          note => `      <li class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <a href="${BASE}garden/${note.slug}/" class="text-base font-bold text-blue-600 dark:text-blue-400 hover:underline">${note.title}</a>
        <div class="mt-1 flex flex-wrap gap-1.5 text-[11px] font-mono text-gray-500 dark:text-gray-400">
          ${note.tags.map(t => `<span class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">#${t}</span>`).join('\n          ')}
        </div>
      </li>`
        )
        .join('\n')
    : `      <li class="text-sm text-gray-500 dark:text-gray-400 italic">No public notes yet. Mark a note "Public" in the editor to publish it here.</li>`;

  const body = `    <h1 class="text-2xl font-bold mb-6">Digital Garden</h1>
    <ul>
${listHtml}
    </ul>`;

  return pageShell('Digital Garden', body, stylesheetHref);
}

function renderNotePage(note: GardenNote, stylesheetHref: string): string {
  const markdownHtml = renderToStaticMarkup(React.createElement(MarkdownViewer, { content: note.body }));
  const body = `    <a href="${BASE}garden/" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">&larr; Digital Garden</a>
    <h1 class="text-2xl font-bold mt-3 mb-1">${note.title}</h1>
    <div class="mb-4 flex flex-wrap gap-1.5 text-[11px] font-mono text-gray-500 dark:text-gray-400">
      ${note.tags.map(t => `<span class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">#${t}</span>`).join('\n      ')}
    </div>
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
${markdownHtml}
    </div>`;

  return pageShell(note.title, body, stylesheetHref);
}

function main() {
  const notes = loadPublicNotes();
  const stylesheetHref = findBuiltStylesheetHref();

  fs.mkdirSync(GARDEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(GARDEN_DIR, 'index.html'), renderIndexPage(notes, stylesheetHref));

  for (const note of notes) {
    const noteDir = path.join(GARDEN_DIR, note.slug);
    fs.mkdirSync(noteDir, { recursive: true });
    fs.writeFileSync(path.join(noteDir, 'index.html'), renderNotePage(note, stylesheetHref));
  }

  console.log(`Digital garden: published ${notes.length} note(s) to dist/garden/`);
}

main();
