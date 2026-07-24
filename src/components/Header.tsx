import React, { useState } from 'react';
import { AppConfig } from '../types';
import { FolderGit2, Key, RefreshCw, Trash2, ChevronDown, ChevronUp, Github, Settings } from 'lucide-react';

interface HeaderProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onForgetToken: () => void;
  onConnect: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onUpdateConfig,
  onForgetToken,
  onConnect,
  isLoading
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(!config.token || !config.owner || !config.repo);

  const handleChange = (field: keyof AppConfig, value: string) => {
    onUpdateConfig({
      ...config,
      [field]: value
    });
  };

  const isConfigComplete = Boolean(config.owner && config.repo && config.token);

  return (
    <header className="bg-white border-b border-gray-200 shadow-2xs sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & App Title */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
                GitHub Notes
                <span className="text-[10px] uppercase tracking-wider font-mono font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                  REST Contents API
                </span>
              </h1>
            </div>
          </div>

          {/* Configuration Summary & Expand Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isConfigComplete && (
              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
                <Github className="w-3.5 h-3.5 text-gray-500" />
                <span>{config.owner}/{config.repo}</span>
                <span className="text-gray-300">|</span>
                <span className="text-blue-600 font-semibold">{config.branch}</span>
                <span className="text-gray-300">|</span>
                <span>{config.notesFolder}/</span>
              </div>
            )}

            <button
              type="button"
              onClick={onConnect}
              disabled={isLoading || !isConfigComplete}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border shadow-2xs transition-all ${
                isLoading || !isConfigComplete
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 active:scale-[0.98]'
              }`}
              title="Refresh notes from GitHub repository"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Syncing...' : 'Sync Repository'}</span>
              <span className="sm:hidden">{isLoading ? 'Syncing...' : 'Sync'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
              aria-label="Toggle repository settings"
              title="Configure GitHub Connection"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Form */}
        {isExpanded && (
          <div className="py-3 px-2 border-t border-gray-100 bg-gray-50/50 rounded-b-lg mb-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Owner */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Owner / Org <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.owner}
                  onChange={(e) => handleChange('owner', e.target.value)}
                  placeholder="octocat"
                  className="w-full px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Repo */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Repository <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.repo}
                  onChange={(e) => handleChange('repo', e.target.value)}
                  placeholder="my-notes"
                  className="w-full px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Branch */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  value={config.branch}
                  onChange={(e) => handleChange('branch', e.target.value)}
                  placeholder="main"
                  className="w-full px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Folder */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Notes Folder
                </label>
                <input
                  type="text"
                  value={config.notesFolder}
                  onChange={(e) => handleChange('notesFolder', e.target.value)}
                  placeholder="notes"
                  className="w-full px-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Token */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                    Personal Token <span className="text-red-500">*</span>
                  </label>
                  {config.token && (
                    <button
                      type="button"
                      onClick={onForgetToken}
                      className="text-[10px] text-red-600 hover:text-red-800 flex items-center gap-0.5 font-medium"
                      title="Clear token from storage"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Forget
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={config.token}
                    onChange={(e) => handleChange('token', e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full pl-7 pr-2.5 py-2 sm:py-1.5 text-sm sm:text-xs font-mono bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Key className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2.5 sm:top-2" />
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-200/60 pt-2">
              <span>
                🔒 Credentials saved safely in local storage with in-memory sandbox protection.
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-blue-600 hover:underline font-medium flex items-center gap-1"
              >
                Hide Settings <ChevronUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
