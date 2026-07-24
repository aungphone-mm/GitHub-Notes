# GitHub Notes — Project Analysis

_Analysis of commit `0c26305` (branch `claude/analysis-project-mw5utz`), 2026-07-24._

---

## 1. What this project is

A single-page React app that uses a GitHub repository as the storage backend for
Markdown notes. There is no server component: the browser talks directly to
`https://api.github.com` with a Personal Access Token supplied by the user, and every
note operation becomes a real commit via the Contents API.

| | |
|---|---|
| Stack | React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, lucide-react |
| Size | 18 source files, ~4,200 LOC (`src/`) |
| Build | `vite build` → 300 kB JS / 86 kB gzip, single chunk (verified) |
| Tests | none |
| CI | none |
| Docs | none (`README.md` was deleted in the scaffold commit `37a883a`) |
| History | 8 commits, all authored 2026-07-24 |

### Module inventory

| File | LOC | Role |
|---|---:|---|
| `src/App.tsx` | 621 | All application state + every async handler + layout |
| `src/components/HabitTracker.tsx` | 639 | Habit checklist, 7-day matrix, GitHub Action snippets |
| `src/components/NoteList.tsx` | 610 | Sidebar: search, tag cloud, favorites, delete |
| `src/components/NoteEditor.tsx` | 560 | Editor, preview toggle, templates modal, delete modal |
| `src/lib/githubApi.ts` | 378 | All GitHub REST calls + typed error class |
| `src/components/CalendarView.tsx` | 376 | Month grid, notes-by-date mapping |
| `src/components/MarkdownViewer.tsx` | 191 | Hand-rolled Markdown renderer |
| `src/lib/templates.ts` | 179 | 6 note boilerplate templates |
| `src/components/Header.tsx` | 204 | Config bar (owner/repo/branch/folder/token), theme toggle |
| `src/lib/frontmatter.ts` | 85 | YAML frontmatter parse/serialize |
| `src/components/CommitFooter.tsx` | 71 | Session commit trail |
| `src/lib/storage.ts` | 68 | localStorage wrapper with in-memory fallback |
| `src/types.ts` | 58 | Shared interfaces |
| `src/components/StatusBar.tsx` | 54 | Global status line |
| `src/lib/slug.ts` | 42 | Filename slug rules |
| `src/lib/encoding.ts` | 27 | UTF-8-safe base64 (chunked) |

### Data flow

```
Header (config)  ──►  safeStore (localStorage)  ──►  App state
                                                      │
     ┌────────────────────────────────────────────────┤
     ▼                                                ▼
listNotes()  ── GET /git/trees/{branch}?recursive=1 ──► NoteHeader[]  (path, sha, name only)
readNote()   ── GET /contents/{path}?ref={branch}   ──► NoteDetail    (+ title, tags, body)
saveNote()   ── PUT /contents/{path}                ──► commit
deleteNote() ── DELETE /contents/{path}             ──► commit
appendToDailyLog() ─ GET (404-tolerant) then PUT    ──► commit
searchNotesCode()  ─ GET /search/code                ──► path matches
```

Local-only state (never committed): theme, favorites (`github_notes_favorites`),
habits and habit completions (`gh_notes_habits_v2`, `gh_notes_habit_completions_v2`).

---

## 2. What is done well

- **The core storage contract is sound.** SHA-based optimistic concurrency is
  implemented end to end: `saveNote` passes the blob SHA, `ghFetch` maps 409 to a
  dedicated error (`githubApi.ts:77-83`), `App` surfaces a conflict banner and a
  "Re-fetch Latest" action (`NoteEditor.tsx:175-192`). This is the part most
  implementations of this idea get wrong.
- **UTF-8 base64 handling is correct and deliberate.** `encoding.ts` uses
  `TextEncoder` with 32 KB chunking rather than the common `btoa(unescape(...))`
  hack, so Burmese script and emoji round-trip intact. `b64decode` strips the
  newlines GitHub inserts into `content`.
- **`ghFetch` is a genuine abstraction**, not a wrapper: pre-flight config
  validation, network-error wrapping, content-type-aware JSON parsing, per-status
  messages, and an opt-in 404→`null` mode used by the daily-log append.
- **`SafeStorage` degrades instead of throwing** when `localStorage` is unavailable
  (Safari private mode, embedded webviews).
- **The Markdown preview escapes by construction** — it builds React elements and
  never touches `dangerouslySetInnerHTML`, so note content cannot inject HTML.
- **Dark mode and mobile layout are carried through consistently** across all
  components rather than bolted onto one screen.
- **The commit footer is a nice touch**: it makes the "every edit is a commit" model
  visible, with real links to `github.com/{owner}/{repo}/commit/{sha}`.

---

## 3. Findings

Severity reflects impact on a user of the app, not effort to fix.

| # | Severity | Finding |
|---|---|---|
| F1 | **High** | Type checking is effectively disabled — `@types/react` is missing |
| F2 | **High** | Four type errors and one wrong-shape object hidden behind F1 |
| F3 | **High** | Habit tracker mixes UTC and local dates; checklist and matrix write different keys |
| F4 | **High** | A failed "Append to Today" silently discards the note body |
| F5 | Medium | Saving a note drops any frontmatter key other than title/tags/updated |
| F6 | Medium | Note metadata is empty until a note is opened, so search/tags/calendar under-report |
| F7 | Medium | Truncated tree responses are ignored — notes can silently disappear |
| F8 | Medium | Tag filtering matches substrings anywhere in the path/title |
| F9 | Medium | PAT is stored in plaintext `localStorage` by default, with no CSP |
| F10 | Medium | Hand-rolled Markdown renderer can't render the app's own templates |
| F11 | Medium | The "GitHub Issues Planner" panel is non-functional placeholder UI |
| F12 | Low | Three sequential API calls per save; the append path has no conflict affordance |
| F13 | Low | Four unused dependencies and stale Gemini/AI-Studio scaffolding |
| F14 | Low | No tests, no CI, no README, no ESLint |
| F15 | Low | `App.tsx` holds all state; two overlapping view-mode variables |

---

### F1 — Type checking is effectively disabled · **High**

`package.json:25-34` lists `@types/node` but **not `@types/react` or
`@types/react-dom`**. Because `React` therefore resolves to `any`, every
`React.FC<SomeProps>` component receives an `any`-typed props parameter, and JSX
elements are `any`. The prop interfaces in this codebase are decorative — nothing
checks them.

The `lint` script (`tsc --noEmit`) reports **zero errors**, which looks like a clean
bill of health and is not one:

```
$ npm run lint
> tsc --noEmit
$ npm i --no-save @types/react@^19 @types/react-dom@^19 && npx tsc --noEmit
src/App.tsx(228,20): error TS2345: ... Property 'rawContent' is missing ...
src/components/CalendarView.tsx(63,16): error TS2551: Property 'updated' does not exist on type 'NoteHeader'. Did you mean 'updatedAt'?
src/components/CalendarView.tsx(64,37): error TS2551: ...
src/components/CalendarView.tsx(362,25): error TS2551: ...
src/components/CalendarView.tsx(365,35): error TS2551: ...
```

**Fix:** add `@types/react` and `@types/react-dom` to `devDependencies`, then fix F2.
Consider also enabling `"strict": true` and `"noUnusedLocals": true` in
`tsconfig.json` — currently neither is set, so implicit `any` and dead imports pass.

### F2 — Errors hidden behind F1 · **High**

- **`CalendarView.tsx:63, 64, 362, 365` read `note.updated`, which does not exist on
  `NoteHeader`** (the interface declares `updatedAt`, `types.ts:14`). Neither field is
  ever populated by `listNotes`. So the "map a note onto the date in its `updated`
  timestamp" branch never runs, and the `Clock` timestamp row in the day panel never
  renders. Two features that appear implemented are dead code.
- **`App.tsx:228` constructs a draft `NoteDetail` without the required `rawContent`
  field**, so any consumer reading `currentNote.rawContent` for a
  calendar-originated draft gets `undefined` against a non-optional type.

### F3 — Habit dates mix UTC and local time · **High**

`HabitTracker.tsx` derives date keys three different ways:

| Location | Expression | Timezone |
|---|---|---|
| `:87` `todayStr` (checklist writes) | `new Date().toISOString().split('T')[0]` | **UTC** |
| `:117` `matrixDays` (matrix cells) | local midnight → `.toISOString()` | **shifted** |
| `:162` `calculateStreak` | local midnight → `.toISOString()` | **shifted** |

Meanwhile `githubApi.ts:242-246` (`appendToDailyLog`) and `CalendarView.tsx:17-22`
(`formatDateKey`) both build date strings from local `getFullYear/getMonth/getDate`.

Verified in Asia/Yangon (UTC+06:30), the repo's apparent home timezone
(`HabitTracker.tsx:234` hard-codes a Yangon cron offset), at 10:00 local:

```
todayStr (checklist)      2026-07-24
matrixToday (matrix "Today") 2026-07-23   ← different key
localDaily (daily note)   2026-07-24
```

Consequences, all user-visible:

1. Ticking a habit in "Today's Habit Checklist" writes key `2026-07-24`; the matrix's
   **Today** column reads `2026-07-23`, so the tick does not appear there.
2. `calculateStreak` reads the shifted keys, so **checklist completions never count
   toward any streak** — only matrix-cell toggles do.
3. The habit block posted by "Post Issue Planner" is titled with the UTC date while
   the daily note it lands in is named with the local date; on either side of
   midnight they disagree.

Every positive UTC offset breaks the early hours of each day; negative offsets break
the late evening.

**Fix:** move `formatDateKey(date: Date): string` (already correct in
`CalendarView.tsx:17-22`) into `src/lib/` and use it as the single source of date
keys in `HabitTracker`, `githubApi.appendToDailyLog`, and `NoteEditor.targetPath`.

### F4 — A failed append silently discards the user's text · **High**

```ts
// NoteEditor.tsx:156-160
const handleAppendDaily = async () => {
  if (isLoading || !content.trim()) return;
  await onAppendToDaily(content);
  setContent('');            // ← runs even when the append failed
};
```

`App.handleAppendDaily` (`App.tsx:308-348`) catches every error, sets a status
message, and **never rethrows**. So the `await` resolves normally on failure and the
editor is cleared. A 401 (expired token), a 409, or a dropped connection destroys
whatever the user had typed, with no draft anywhere to recover it.

**Fix:** have the `App` handlers rethrow after setting status (or return
`Promise<boolean>`), and clear the editor only on success. The same pattern should be
audited in `handleSave`/`handleDelete`, which currently get away with it only because
they don't clear state.

### F5 — Saving drops unknown frontmatter · Medium

`parseNoteContent` (`frontmatter.ts:29-85`) extracts exactly `title`, `tags`, and
`updated` and discards the rest of the YAML block; `serializeNoteContent`
(`frontmatter.ts:10-27`) writes exactly those three back. Any other key a user has in
their notes — `aliases`, `author`, `status`, `publish`, Obsidian/Jekyll fields — is
**silently deleted the first time the note is saved from this app**.

For a tool whose premise is "your notes remain ordinary files in your own repo",
lossy round-tripping is a significant correctness issue.

**Fix:** keep the unrecognised YAML lines on `NoteDetail` and re-emit them, or store
the raw frontmatter block and patch only the three managed keys.

### F6 — List metadata is empty until a note is opened · Medium

`listNotes` (`githubApi.ts:112-161`) returns only `path`, `sha`, `name`, `size`, and
`isDaily` — everything the tree API gives. `title`, `tags`, and `content` are filled
in only when a note is selected (`App.tsx:184-189`). On a fresh page load, therefore:

- the sidebar shows filename-derived titles, not real ones;
- the **Tag Cloud** (`NoteList.tsx:65-102`) only sees tags from notes visited in this
  session — on load it is empty or near-empty;
- local search over `n.content` (`NoteList.tsx:229`) matches almost nothing, so
  "search note content" really searches filenames unless `/search/code` answers;
- the calendar can only date-match on the path (see also F2).

Several features look broken rather than lazy.

**Options:** (a) hydrate in the background with a bounded concurrency queue after
`listNotes`; (b) commit a generated `notes/.index.json` and read that; (c) keep the
behaviour but label the affected UI ("tags from opened notes").

### F7 — Truncated trees are ignored · Medium

`GET /git/trees/{sha}?recursive=1` returns `truncated: true` and a partial array once
a tree exceeds GitHub's limits. `listNotes` checks only `Array.isArray(data.tree)`
(`githubApi.ts:118`) and reports `Found N note(s)` regardless — notes vanish from the
UI with a success message. Check `data.truncated` and surface a warning, or fall back
to per-directory `GET /contents`.

### F8 — Tag filter matches substrings anywhere · Medium

```ts
// NoteList.tsx:174-176
const textToScan = `${n.title} ${n.content} ${n.name} ${n.path}`.toLowerCase();
const hasTextTag = textToScan.includes(`#${tagLower}`) || textToScan.includes(tagLower);
```

The bare `includes(tagLower)` has no word boundary and scans the path, so clicking
tag `rfc` matches `notes/rfc-archive/anything.md`, and any tag that is a substring of
a directory name over-matches. Restrict to parsed `tags`, `isDaily`, and `#tag` with
a boundary — the same `hashtagRegex` already used to build the cloud
(`NoteList.tsx:85`).

### F9 — Token storage and origin hardening · Medium

`storage.ts:57-59` persists the entire config, **including the PAT**, as plaintext
JSON under `gh_notes_config_v1`, and `Header.tsx:27-32` rewrites it on every
keystroke. A classic PAT with `repo` scope grants read/write to *every* repository
the user owns, so anything that can read the origin's `localStorage` — a shared
machine, a browser extension, a future XSS — gets that.

Current mitigations: there is a "Forget" button (`Header.tsx:189-195`), the input is
`type="password"`, and requests only ever go to `api.github.com`. What's missing:

- Persisting the token should be **opt-in** ("remember on this device"), with
  in-memory or `sessionStorage` as the default.
- No `Content-Security-Policy` in `index.html`; a `connect-src 'self'
  https://api.github.com` meta tag is cheap defence in depth.
- No guidance in the UI toward a **fine-grained PAT** scoped to
  `contents: read/write` on the single notes repo, which is the right credential here.

Related, and worth stating precisely so it isn't over-weighted: `MarkdownViewer.tsx:169`
passes link URLs to `href` with no scheme allowlist. React 19 neutralises
`javascript:` URLs (verified — it substitutes a throwing expression) and browsers
block top-level `data:` navigation, so this is hardening, not an open hole. An
`http/https/mailto` allowlist is still worth the three lines.

### F10 — The Markdown renderer can't render this app's own templates · Medium

`MarkdownViewer.tsx` is a 190-line line-based renderer. Gaps, in rough order of
impact:

- **No table support**, yet the bundled "Project Plan" template ships a Markdown
  table (`templates.ts:55-60`) — it renders as literal `|` rows. The templates and
  the renderer disagree about what Markdown is.
- **No horizontal rules**, and the "Meeting Notes" template opens with `---`
  (`templates.ts:77`), which renders as a stray paragraph.
- No ordered lists, images, nested lists, or `####`+ headings (a `#### ` line renders
  with its hashes visible).
- An **unterminated code fence swallows the remainder of the document**: on end of
  input, `codeBlockLines` is never flushed (`:24-48`).
- `isChecked = line.includes('[x]')` (`:78`) — a task item whose *text* contains
  `[x]` anywhere shows as checked.
- The italic rule `^(\*|_)(.*?)\1` (`:178`) italicises `snake_case` identifiers.
- Inline formatting isn't recursive, so ``**bold `code`**`` shows the backticks.
- `<li>` is emitted with no enclosing `<ul>` (`:100`) — invalid nesting.

**Recommendation:** replace with `react-markdown` + `remark-gfm`, or
`markdown-it` + DOMPurify. That is a few kB gzipped against 190 lines of partial
reimplementation that the project's own content already outgrows.

### F11 — The Issues Planner panel does nothing · Medium

In `HabitTracker.tsx`:

- the **"GITHUB PLANNER ISSUES"** KPI card reports
  `todayCompletedCount > 0 ? '1' : '0'` (`:324`) — a local habit count relabelled as
  a GitHub issue count;
- **"Fetch Issues"** (`:515-525`) sets the toast `Issues Refreshed!` and makes no
  request;
- `plannerMdTemplate` (`:247-265`) is built on every render but never displayed or
  copied, and `copiedSection === 'planner'` is never set — the only copy button
  copies the YAML.

No code path in the project calls the Issues API. Either implement it
(`GET /repos/{owner}/{repo}/issues?labels=daily-planner`) or relabel the section as
the setup guide it currently is.

### F12 — Write-path cost and the append conflict gap · Low

Every save issues three sequential requests (`App.tsx:259-287`): `PUT /contents`, then
a **full recursive tree** `listNotes`, then `readNote`. The PUT response already
returns `content.sha`, so both follow-ups are avoidable; on a large repo, Ctrl+S
becomes an expensive round trip.

`appendToDailyLog` (`githubApi.ts:238-300`) is an unguarded read-modify-write. A
concurrent commit produces a 409, and unlike the save path (`App.tsx:289-294`) the
append handler never sets `conflictError` (`:339-347`), so the user sees a generic
error with no "re-fetch" affordance. A single retry-on-409 would make appends
effectively reliable.

### F13 — Dead dependencies and stale scaffolding · Low

`@google/genai`, `express`, `dotenv`, and `motion` are in `dependencies` but imported
**nowhere** in `src/` (verified by grep). Alongside them:

- `metadata.json:5` still declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`;
- `.env.example` documents `GEMINI_API_KEY` and `APP_URL`, neither of which the app
  reads;
- `package.json:2` is still named `react-example`;
- `clean` removes a `server.js` that does not exist;
- the `@` → repo-root alias (`vite.config.ts:10-12`) is unused.

This is leftover AI Studio scaffolding. Removing it shrinks installs and audit noise.

### F14 — No tests, no CI, no README · Low

4.2 kLOC with zero test files, no `.github/` directory, and no README (deleted in
`37a883a`). `npm run lint` checks nothing (F1) and there is no ESLint config.

The highest-value target is obvious: the pure modules — `slug.ts`, `frontmatter.ts`,
`encoding.ts`, date-key derivation, and `listNotes`' filtering — are trivially
unit-testable with Vitest, have no I/O, and are **exactly where F3, F5, and F8 live**.
A dozen tests plus a GitHub Action running `tsc --noEmit` and `vitest run` would have
caught most of this document.

### F15 — Structural notes · Low

- **`App.tsx` is the application.** 621 lines holding config, notes, selection,
  status, commits, theme, favorites, two view-mode states, and all eight async
  handlers. Every handler closes over `config`, so a keystroke in the Settings bar
  re-creates all of them and re-renders the tree. Extracting `useGitHubConfig()` and
  `useNotes()` hooks (or a reducer) would isolate the network logic and make it
  testable.
- **Two variables model one concept.** `activeView` and `mobileTab`
  (`App.tsx:21-22`) are combined with `||` at `:542-570`, which makes some
  combinations unreachable and the mobile/desktop switch harder to reason about than
  a single `view` value plus a breakpoint.
- **Modals lack Escape, focus trapping, and `role="dialog"`** (`NoteEditor.tsx:366`,
  `:415`; `NoteList.tsx:573`; `HabitTracker.tsx:594`).
- **`NoteEditor.tsx:123-135`** rebinds a global `keydown` listener on every keystroke
  and omits `handleSave` from its deps; a ref would fix both.
- **`App.tsx:164-168`** is a deliberate mount-only effect with `[]` deps calling
  `handleLoadNotes`; correct today, but it will trip `exhaustive-deps` the moment
  ESLint lands — make the intent explicit.
- **`HabitTracker` declares `notes` and `selectedPath` props** (`:20-25`) it never
  destructures, while `App.tsx:545-546` dutifully passes them. Six lucide icons are
  imported and unused (`CheckCircle2`, `Circle`, `Plus`, `Flame`, `ListTodo`,
  `TrendingUp`).
- **Theme and favorites bypass `SafeStorage`** and touch `localStorage` directly
  (`App.tsx:32-63`); the theme write at `:45` is not wrapped in `try/catch`, so it
  throws in exactly the environments `SafeStorage` exists to handle.
- **One 300 kB chunk**; `CalendarView` and `HabitTracker` are natural `React.lazy`
  boundaries.

---

## 4. Recommended order of work

**First — make the compiler useful again.**
1. Add `@types/react` / `@types/react-dom`; fix the five errors (F1, F2).
2. Turn on `strict` and `noUnusedLocals`; fix the fallout.
3. Add a GitHub Action running `tsc --noEmit` on push.

**Second — stop losing user data.**
4. Clear the editor only on a successful append (F4).
5. Preserve unknown frontmatter across saves (F5).
6. One local `formatDateKey` used everywhere; add unit tests across timezones (F3).

**Third — make the features honest.**
7. Handle `truncated` trees (F7).
8. Fix tag-filter matching (F8); decide on metadata hydration (F6).
9. Implement or relabel the Issues Planner panel (F11).
10. Swap in a real Markdown renderer (F10).

**Fourth — hardening and hygiene.**
11. Opt-in token persistence, CSP meta tag, fine-grained-PAT guidance (F9).
12. Drop the four unused dependencies and the Gemini scaffolding (F13).
13. Skip the redundant refetches after save; retry appends on 409 (F12).
14. Write a README; extract `useNotes()` from `App.tsx` (F14, F15).

---

## 5. How these findings were checked

```bash
npm install
npm run lint                       # 0 errors — see F1 for why that is misleading
npm i --no-save @types/react@^19 @types/react-dom@^19 && npx tsc --noEmit   # 5 errors
npm run build                      # succeeds: 300.62 kB JS / 86.28 kB gzip
TZ=Asia/Yangon node -e "..."       # reproduced the F3 date-key divergence
grep -rE 'genai|express|dotenv|motion' src/   # no matches → F13
```

Everything in §3 was read in the source or reproduced with one of the commands above;
no finding here is inferred from naming alone.
