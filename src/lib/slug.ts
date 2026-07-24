/**
 * Slug rule according to contract:
 * Strip / \ : * ? " < > | # % and control chars, collapse whitespace to -,
 * trim leading/trailing dashes, cap at 80 chars, fall back to 'untitled'.
 * Does NOT strip non-ASCII (Burmese filenames are valid).
 */
export function slugify(text: string): string {
  if (!text) return 'untitled';

  // 1. Strip prohibited special characters and control characters
  let slug = text.replace(/[\/\\:\*\?"<>\|#%\x00-\x1F\x7F]/g, '');

  // 2. Collapse whitespace to single dash
  slug = slug.replace(/\s+/g, '-');

  // 3. Trim leading and trailing dashes
  slug = slug.replace(/^-+|-+$/g, '');

  // 4. Cap at 80 chars
  if (slug.length > 80) {
    slug = slug.substring(0, 80).replace(/-+$/, '');
  }

  // 5. Fall back if empty
  return slug || 'untitled';
}

/**
 * Derives a clean human-readable title from a note filename or path
 */
export function titleFromPath(path: string): string {
  const segments = path.split('/');
  const filename = segments[segments.length - 1] || path;
  let baseName = filename.replace(/\.md$/i, '');

  // If path format is YYYY-MM-DD-title, strip date prefix for display title
  baseName = baseName.replace(/^\d{4}-\d{2}-\d{2}-/, '');

  // Replace dashes/underscores with spaces
  const title = baseName.replace(/[-_]+/g, ' ').trim();
  return title || filename;
}
