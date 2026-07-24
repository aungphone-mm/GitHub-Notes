import React from 'react';

interface MarkdownViewerProps {
  content: string;
}

/**
 * Clean lightweight Markdown renderer supporting common syntax:
 * Headings (#, ##, ###), bold (**), italic (*), code blocks (```),
 * inline code (`), lists (- or *), blockquotes (>), links [text](url),
 * task checkboxes (- [x] or - [ ]), and paragraphs.
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  if (!content.trim()) {
    return (
      <div className="p-8 text-center text-xs text-gray-400 font-mono italic">
        Markdown preview is empty. Start typing in the editor...
      </div>
    );
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  lines.forEach((line, index) => {
    // Handle code blocks ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre key={`code-${index}`} className="my-3 p-3 bg-gray-900 text-gray-100 font-mono text-xs rounded-lg overflow-x-auto leading-relaxed border border-gray-800">
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

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-xl font-bold text-gray-900 my-3 font-sans-myanmar border-b border-gray-200 pb-1">
          {renderFormattedText(line.slice(2))}
        </h1>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-lg font-bold text-gray-900 mt-4 mb-2 font-sans-myanmar border-b border-gray-100 pb-1">
          {renderFormattedText(line.slice(3))}
        </h2>
      );
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-base font-bold text-gray-900 mt-3 mb-1.5 font-sans-myanmar">
          {renderFormattedText(line.slice(4))}
        </h3>
      );
      return;
    }

    // Task Checkboxes: - [ ] or - [x]
    if (/^\s*-\s*\[([ xX])\]\s*/.test(line)) {
      const isChecked = line.includes('[x]') || line.includes('[X]');
      const text = line.replace(/^\s*-\s*\[([ xX])\]\s*/, '');
      elements.push(
        <div key={index} className="flex items-start gap-2 my-1 text-xs text-gray-800 font-sans-myanmar">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className={isChecked ? 'line-through text-gray-400' : ''}>
            {renderFormattedText(text)}
          </span>
        </div>
      );
      return;
    }

    // Unordered list items: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '');
      elements.push(
        <li key={index} className="ml-5 list-disc my-0.5 text-xs text-gray-800 font-sans-myanmar leading-relaxed">
          {renderFormattedText(text)}
        </li>
      );
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="my-2 pl-3 py-1 border-l-4 border-blue-500 bg-blue-50/50 text-xs italic text-gray-700 rounded-r">
          {renderFormattedText(line.slice(2))}
        </blockquote>
      );
      return;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={index} className="h-2" />);
      return;
    }

    // Standard Paragraph
    elements.push(
      <p key={index} className="my-1.5 text-xs text-gray-800 leading-relaxed font-sans-myanmar">
        {renderFormattedText(line)}
      </p>
    );
  });

  return (
    <div className="prose prose-xs max-w-none text-gray-900 p-4 font-sans-myanmar select-text">
      {elements}
    </div>
  );
};

function renderFormattedText(text: string): React.ReactNode {
  // Simple regex parser for inline markdown formatting (**bold**, *italic*, `code`, [link](url))
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold text-gray-900">{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Inline code `text`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-gray-100 text-pink-600 font-mono text-[11px] rounded border border-gray-200">
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
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch) {
      parts.push(<em key={key++} className="italic text-gray-800">{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Next character
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}
