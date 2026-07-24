import React from 'react';
import { CommitNode } from '../types';
import { GitCommit, GitBranch, ExternalLink } from 'lucide-react';

interface CommitFooterProps {
  commits: CommitNode[];
  owner: string;
  repo: string;
}

export const CommitFooter: React.FC<CommitFooterProps> = ({ commits, owner, repo }) => {
  if (!commits || commits.length === 0) {
    return (
      <footer className="bg-white border-t border-gray-200 py-2 px-4 text-xs text-gray-400 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-gray-400" />
          <span>Session Commits: No commits yet in this session</span>
        </div>
        <span className="text-[11px] text-gray-300">Newest commits will appear here</span>
      </footer>
    );
  }

  return (
    <footer className="bg-white border-t border-gray-200 py-2.5 px-4 sticky bottom-0 z-10 shadow-lg">
      <div className="flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono font-semibold text-gray-700 mr-2 border-r border-gray-200 pr-3">
          <GitCommit className="w-4 h-4 text-blue-600" />
          <span>Session Log</span>
          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
            {commits.length}
          </span>
        </div>

        {/* Commit nodes list (newest on left, capped at 12) */}
        <div className="flex items-center gap-0 overflow-x-auto py-1 scrollbar-none">
          {commits.slice(0, 12).map((c, index) => {
            const commitUrl = owner && repo && c.sha ? `https://github.com/${owner}/${repo}/commit/${c.sha}` : null;

            return (
              <div key={c.id} className="flex items-center shrink-0 group">
                {/* Connector line on left (except first element) */}
                {index > 0 && (
                  <div className="w-6 h-[2px] bg-blue-200 group-hover:bg-blue-400 transition-colors" />
                )}

                {/* Commit Dot + Short SHA */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-blue-200 hover:border-blue-500 rounded-full pl-1.5 pr-2.5 py-0.5 shadow-2xs transition-all hover:bg-blue-50/50">
                  {/* Animated dot */}
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75 motion-reduce:hidden" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                  </div>

                  {commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                      title={`${c.message} (${c.timestamp})`}
                    >
                      {c.shortSha || 'commit'}
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                    </a>
                  ) : (
                    <span
                      className="font-mono text-[11px] font-bold text-blue-700"
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

        <div className="text-[10px] font-mono text-gray-400 shrink-0 hidden md:block">
          Capped at 12 session nodes
        </div>
      </div>
    </footer>
  );
};
