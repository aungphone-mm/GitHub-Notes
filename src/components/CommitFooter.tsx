import React from 'react';
import { CommitNode } from '../types';
import { ExternalLink } from 'lucide-react';

interface CommitFooterProps {
  commits: CommitNode[];
  owner: string;
  repo: string;
}

export const CommitFooter: React.FC<CommitFooterProps> = ({ commits, owner, repo }) => {
  if (!commits || commits.length === 0) {
    return (
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-2.5 px-4 text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center justify-between select-none shrink-0 transition-colors">
        <span className="font-bold text-gray-600 dark:text-gray-300 tracking-wider">SESSION COMMITS</span>
        <span className="text-gray-500 dark:text-gray-400">No commits yet in this session</span>
      </footer>
    );
  }

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-2 px-4 flex items-center justify-between gap-4 font-mono text-xs text-gray-600 dark:text-gray-400 shrink-0 transition-colors">
      <div className="font-bold text-gray-700 dark:text-gray-300 tracking-wider shrink-0">
        SESSION COMMITS ({commits.length})
      </div>

      <div className="flex items-center gap-0 overflow-x-auto py-0.5 scrollbar-none">
        {commits.slice(0, 12).map((c, index) => {
          const commitUrl = owner && repo && c.sha ? `https://github.com/${owner}/${repo}/commit/${c.sha}` : null;

          return (
            <div key={c.id} className="flex items-center shrink-0 group">
              {index > 0 && (
                <div className="w-5 h-[2px] bg-blue-200 dark:bg-blue-900 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors" />
              )}

              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-900 hover:border-blue-500 dark:hover:border-blue-400 rounded-full px-2.5 py-0.5 shadow-2xs transition-all hover:bg-blue-50 dark:hover:bg-blue-950/50">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />

                {commitUrl ? (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
                    title={`${c.message} (${c.timestamp})`}
                  >
                    {c.shortSha || 'commit'}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ) : (
                  <span
                    className="text-[11px] font-bold text-blue-700 dark:text-blue-400"
                    title={`${c.message} (${c.timestamp})`}
                  >
                    {c.shortSha || 'commit'}
                  </span>
                )}

                <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:inline max-w-[120px] truncate">
                  {c.message.replace(/^note:\s*/, '')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </footer>
  );
};

