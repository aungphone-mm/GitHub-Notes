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
      <footer className="bg-white border-t border-gray-200 py-2.5 px-4 text-xs font-mono text-gray-500 flex items-center justify-between select-none shrink-0">
        <span className="font-bold text-gray-600 tracking-wider">SESSION COMMITS</span>
        <span className="text-gray-500">No commits yet in this session</span>
      </footer>
    );
  }

  return (
    <footer className="bg-white border-t border-gray-200 py-2 px-4 flex items-center justify-between gap-4 font-mono text-xs text-gray-600 shrink-0">
      <div className="font-bold text-gray-700 tracking-wider shrink-0">
        SESSION COMMITS ({commits.length})
      </div>

      <div className="flex items-center gap-0 overflow-x-auto py-0.5 scrollbar-none">
        {commits.slice(0, 12).map((c, index) => {
          const commitUrl = owner && repo && c.sha ? `https://github.com/${owner}/${repo}/commit/${c.sha}` : null;

          return (
            <div key={c.id} className="flex items-center shrink-0 group">
              {index > 0 && (
                <div className="w-5 h-[2px] bg-blue-200 group-hover:bg-blue-400 transition-colors" />
              )}

              <div className="flex items-center gap-1.5 bg-gray-50 border border-blue-200 hover:border-blue-500 rounded-full px-2.5 py-0.5 shadow-2xs transition-all hover:bg-blue-50">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600 shrink-0" />

                {commitUrl ? (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                    title={`${c.message} (${c.timestamp})`}
                  >
                    {c.shortSha || 'commit'}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ) : (
                  <span
                    className="text-[11px] font-bold text-blue-700"
                    title={`${c.message} (${c.timestamp})`}
                  >
                    {c.shortSha || 'commit'}
                  </span>
                )}

                <span className="text-[10px] text-gray-500 hidden sm:inline max-w-[120px] truncate">
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

