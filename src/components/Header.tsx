import React from 'react';
import { AppConfig } from '../types';
import { Github, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onForgetToken: () => void;
  onConnect: () => void;
  isLoading: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onUpdateConfig,
  onForgetToken,
  onConnect,
  isLoading,
  theme,
  onToggleTheme
}) => {
  const handleChange = (field: keyof AppConfig, value: string) => {
    onUpdateConfig({
      ...config,
      [field]: value
    });
  };

  const isConfigComplete = Boolean(config.owner && config.repo && config.token);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 z-20 transition-colors">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-gray-900 dark:text-gray-100 shrink-0" />
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight font-sans">
              GitHub Notes
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-gray-500 dark:text-gray-400 hidden sm:block select-none">
              Ctrl+S: Save | Ctrl+Enter: New Note
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-gray-700" />
                  <span className="hidden md:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden md:inline">Light</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inputs & Connect Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          {/* Owner */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              OWNER
            </label>
            <input
              type="text"
              value={config.owner}
              onChange={(e) => handleChange('owner', e.target.value)}
              placeholder="Owner"
              className="w-full px-3 py-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Repo */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              REPO
            </label>
            <input
              type="text"
              value={config.repo}
              onChange={(e) => handleChange('repo', e.target.value)}
              placeholder="Repo"
              className="w-full px-3 py-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Branch */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              BRANCH
            </label>
            <input
              type="text"
              value={config.branch}
              onChange={(e) => handleChange('branch', e.target.value)}
              placeholder="main"
              className="w-full px-3 py-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Folder */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              FOLDER
            </label>
            <input
              type="text"
              value={config.notesFolder}
              onChange={(e) => handleChange('notesFolder', e.target.value)}
              placeholder="notes"
              className="w-full px-3 py-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Token */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              TOKEN
            </label>
            <input
              type="password"
              value={config.token}
              onChange={(e) => handleChange('token', e.target.value)}
              placeholder="ghp_..."
              className="w-full px-3 py-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConnect}
              disabled={isLoading || !isConfigComplete}
              className={`flex-1 px-4 py-1.5 text-xs font-semibold rounded-md text-white transition-colors shadow-2xs ${
                isLoading || !isConfigComplete
                  ? 'bg-blue-400 dark:bg-blue-800/60 cursor-not-allowed opacity-80'
                  : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 active:bg-blue-800'
              }`}
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>

            <button
              type="button"
              onClick={onForgetToken}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors whitespace-nowrap shadow-2xs"
            >
              Forget Token
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

