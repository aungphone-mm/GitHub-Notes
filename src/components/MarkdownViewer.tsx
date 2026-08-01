import React from 'react';

interface MarkdownViewerProps {
  content: string;
}

/**
 * Clean lightweight Markdown renderer supporting common syntax:
 * Headings (#–#####), bold (**), italic (*), code blocks (```),
 * inline code (`), ordered/unordered lists, blockquotes (>), links [text](url),
 * task checkboxes (- [x] or - [ ]), tables (| col |), horizontal rules (---),
 * and paragraphs.
 *
 * Fixes vs previous version:
 * - Unclosed ``` code blocks are now flushed at end of content (no silent loss)
 * - Tables are fully rendered including header, separator, and body rows
 * - Numbered lists (1. 2. 3.) are now rendered as <ol> items
 * - h4 and h5 heading levels are now supported
 * - Horizontal rules (--- or ***) are rendered
 * - renderFormattedText has a safety-counter guard to prevent infinite loops
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  if (!content.trim()) {
    return (
      <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 font-mono italic">
        Markdown preview is empty. Start typing in the editor...
      </div>
    );
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  // Code block state
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  // Table state
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableKey = 0;

  /**
   * Flush accumulated table rows into a rendered <table> element.
   */
  const flushTable = () => {
    if (tableHeaders.length === 0 && tableRows.length === 0) return;
    elements.push(
      <div key={`table-${tableKey++}`} className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-xs border-collapse font-sans-myanmar">
          {tableHeaders.length > 0 && (
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                {tableHeaders.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700"
                  >
                    {renderFormattedText(h)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableRows.map((row, ri) => (
              <tr
                key={ri}
                className={
                  ri % 2 === 0
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-gray-50/70 dark:bg-gray-800/50'
                }
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-1.5 text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                  >
                    {renderFormattedText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeaders = [];
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, index) => {
    // ── Code block fence ────────────────────────────────────────────────────
    if (line.trim().startsWith('```')) {
      // Flush any in-progress table before entering a code block
      if (inTable) flushTable();

      if (inCodeBlock) {
        // Close the code block
        elements.push(
          <pre
            key={`code-${index}`}
            className="my-3 p-3 bg-gray-900 dark:bg-black text-gray-100 font-mono text-xs rounded-lg overflow-x-auto leading-relaxed border border-gray-800"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // ── Table rows ───────────────────────────────────────────────────────────
    const isTableRow = /^\|/.test(line);
    // Separator rows look like |---|---| or |:---:|
    const isSeparatorRow = /^\|[\s\-:|]+\|/.test(line) && /[-]/.test(line);

    if (isTableRow) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        tableRows = [];
      } else if (isSeparatorRow) {
        // Skip alignment-separator rows
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable();
    }

    // ── Horizontal rule ──────────────────────────────────────────────────────
    const trimmed = line.trim();
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        <hr key={index} className="my-3 border-gray-200 dark:border-gray-700" />
      );
      return;
    }

    // ── Headings (longest prefix first to avoid false matches) ───────────────
    if (line.startsWith('##### ')) {
      elements.push(
        <h5 key={index} className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2 mb-1 font-sans-myanmar uppercase tracking-widest">
          {renderFormattedText(line.slice(6))}
        </h5>
      );
      return;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={index} className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-2 mb-1 font-sans-myanmar">
          {renderFormattedText(line.slice(5))}
        </h4>
      );
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-base font-bold text-gray-900 dark:text-gray-100 mt-3 mb-1.5 font-sans-myanmar">
          {renderFormattedText(line.slice(4))}
        </h3>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2 font-sans-myanmar border-b border-gray-100 dark:border-gray-800 pb-1">
          {renderFormattedText(line.slice(3))}
        </h2>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-xl font-bold text-gray-900 dark:text-gray-100 my-3 font-sans-myanmar border-b border-gray-200 dark:border-gray-800 pb-1">
          {renderFormattedText(line.slice(2))}
        </h1>
      );
      return;
    }

    // ── Task checkboxes: - [ ] or - [x] ─────────────────────────────────────
    if (/^\s*-\s*\[([ xX])\]\s*/.test(line)) {
      const isChecked = line.includes('[x]') || line.includes('[X]');
      const text = line.replace(/^\s*-\s*\[([ xX])\]\s*/, '');
      elements.push(
        <div key={index} className="flex items-start gap-2 my-1 text-xs text-gray-800 dark:text-gray-200 font-sans-myanmar">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-blue-600 focus:ring-blue-500"
          />
          <span className={isChecked ? 'line-through text-gray-400 dark:text-gray-500' : ''}>
            {renderFormattedText(text)}
          </span>
        </div>
      );
      return;
    }

    // ── Numbered list items: 1. 2. 3. ────────────────────────────────────────
    if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, '');
      elements.push(
        <li key={index} className="ml-6 list-decimal my-0.5 text-xs text-gray-800 dark:text-gray-200 font-sans-myanmar leading-relaxed">
          {renderFormattedText(text)}
        </li>
      );
      return;
    }

    // ── Unordered list items: - or * ─────────────────────────────────────────
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '');
      elements.push(
        <li key={index} className="ml-5 list-disc my-0.5 text-xs text-gray-800 dark:text-gray-200 font-sans-myanmar leading-relaxed">
          {renderFormattedText(text)}
        </li>
      );
      return;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="my-2 pl-3 py-1 border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-xs italic text-gray-700 dark:text-gray-300 rounded-r">
          {renderFormattedText(line.slice(2))}
        </blockquote>
      );
      return;
    }

    // ── Empty line spacer ────────────────────────────────────────────────────
    if (!line.trim()) {
      elements.push(<div key={index} className="h-2" />);
      return;
    }

    // ── Standard paragraph ───────────────────────────────────────────────────
    elements.push(
      <p key={index} className="my-1.5 text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans-myanmar">
        {renderFormattedText(line)}
      </p>
    );
  });

  // ── Flush any unclosed code block ────────────────────────────────────────
  // Prevents content from silently disappearing when a ``` is never closed.
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key="code-unclosed"
        className="my-3 p-3 bg-gray-900 dark:bg-black text-gray-100 font-mono text-xs rounded-lg overflow-x-auto leading-relaxed border border-gray-800"
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  // ── Flush any unclosed table ─────────────────────────────────────────────
  if (inTable) flushTable();

  return (
    <div className="prose prose-xs max-w-none text-gray-900 dark:text-gray-100 p-4 font-sans-myanmar select-text">
      {elements}
    </div>
  );
};

/**
 * Inline markdown formatter: **bold**, *italic*, `code`, [link](url).
 * Includes a safety counter to prevent any edge-case infinite loops.
 */
function renderFormattedText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  // Safety guard: maximum iterations = 2× input length + 10
  const maxIter = text.length * 2 + 10;
  let iter = 0;

  while (remaining.length > 0 && iter++ < maxIter) {
    // Bold **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)([\s\S]*?)\1/);
    if (boldMatch && boldMatch[0].length > 0) {
      parts.push(
        <strong key={key++} className="font-semibold text-gray-900 dark:text-gray-100">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Inline code `text`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-[11px] rounded border border-gray-200 dark:border-gray-700"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Italic *text* or _text_ — only single delimiter (not double-star / double-underscore)
    // The negative-lookahead (?!\1) ensures we don't eat into bold markers.
    const italicMatch = remaining.match(/^(\*(?!\*)|_(?!_))([\s\S]+?)\1(?!\1)/);
    if (italicMatch && italicMatch[0].length > 0) {
      parts.push(
        <em key={key++} className="italic text-gray-800 dark:text-gray-200">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Fallback: consume one character and continue (always advances — no infinite loop)
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}
