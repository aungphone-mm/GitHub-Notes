import { NoteHeader } from '../types';

/** A bare YYYY-MM-DD anywhere in a string, e.g. `daily/2026-07-24.md`. */
const DATE_IN_TEXT = /\b\d{4}-\d{2}-\d{2}\b/g;

/**
 * Every YYYY-MM-DD a note should be filed under.
 *
 * A note can carry more than one date (a path date plus a title date), so the
 * result is a set and the note shows up under each of them.
 *
 * In practice `listNotes` fills in only `path`, `sha`, `name`, `size` and
 * `isDaily` — `title` and `updatedAt` arrive only after the note is opened —
 * so the path is usually the only date source and most notes come back empty.
 * Callers must handle that rather than assume every note lands on a date.
 */
export function datesForNote(note: NoteHeader): string[] {
  const dates = new Set<string>();

  for (const source of [note.path, note.title, note.updatedAt]) {
    if (!source) continue;
    const matches = source.match(DATE_IN_TEXT);
    if (matches) matches.forEach(d => dates.add(d));
  }

  return Array.from(dates);
}

/**
 * Bucket notes by date key. Notes with no date in them appear in no bucket at
 * all — the caller decides whether to drop them or collect them separately.
 */
export function groupNotesByDate(notes: NoteHeader[]): Map<string, NoteHeader[]> {
  const map = new Map<string, NoteHeader[]>();

  for (const note of notes) {
    for (const dateStr of datesForNote(note)) {
      const list = map.get(dateStr);
      if (list) {
        list.push(note);
      } else {
        map.set(dateStr, [note]);
      }
    }
  }

  return map;
}
