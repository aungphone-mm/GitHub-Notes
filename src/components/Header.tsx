import React, { useState } from 'react';
import { AppConfig } from '../types';
import { Github, Sun, Moon, Settings, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, X, Sparkles } from 'lucide-react';

const PAT_WARNING_KEY = 'gh_notes_pat_warning_dismissed';

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
  const isConfigComplete = Boolean(config.owner && config.repo && config.token);
  const [isSettingsOpen, setIsSettingsOpen] = useState(!isConfigComplete);

  // PAT security warning — show once until dismissed
  const [isWarningDismissed, setIsWarningDismissed] = useState(() => {
    try {
      return localStorage.getItem(PAT_WARNING_KEY) === '1';
    } catch {
      return false;
    }
  });

  const handleDismissWarning = () => {
    setIsWarningDismissed(true);
    try {
      localStorage.setItem(PAT_WARNING_KEY, '1');
    } catch {
      // ignore
    }
  };

  const handleChange = (field: keyof AppConfig, value: string) => {
    onUpdateConfig({
      ...config,
      [field]: value
    });
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 z-20 transition-colors shrink-0">
      <div className="max-w-7xl mx-auto space-y-2.5">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-3">
          {/* Logo & Repo Pill */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Github className="w-5 h-5 text-gray-900 dark:text-gray-100 shrink-0" />
              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight font-sans">
                GitHub Notes
              </h1>
            </div>

            {isConfigComplete && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {config.owner}/{config.repo}
                </span>
                <span className="text-gray-400">({config.branch || 'main'})</span>
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-gray-400 dark:text-gray-500 hidden lg:block select-none">
              Ctrl+S: Save | Ctrl+Enter: New Note
            </div>

            {/* Toggle Config Bar */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                isSettingsOpen
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Configure repository credentials"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
              {isSettingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-gray-700" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
          </div>
        </div>

        {/* PAT Security Warning Banner */}
        {isSettingsOpen && !isWarningDismissed && (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Security note:</span> Your GitHub token and settings are stored in browser{' '}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded text-[11px]">localStorage</code>.{' '}
              Do not use this app on shared or public computers. Use a{' '}
              <a
                href="https://github.com/settings/tokens?type=beta"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100"
              >
                fine-grained PAT
              </a>{' '}
              scoped to <em>Contents: Read & Write</em> on a single repo only.
            </div>
            <button
              type="button"
              onClick={handleDismissWarning}
              className="p-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Collapsible Inputs Bar */}
        {isSettingsOpen && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 items-end">
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
                className="w-full px-2.5 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                className="w-full px-2.5 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                className="w-full px-2.5 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                className="w-full px-2.5 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                className="w-full px-2.5 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Gemini API Key */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-500" />
                GEMINI KEY
              </label>
              <input
                type="password"
                value={config.geminiKey || ''}
                onChange={(e) => handleChange('geminiKey', e.target.value)}
                placeholder="AIza… (optional)"
                className="w-full px-2.5 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onConnect();
                  if (isConfigComplete) setIsSettingsOpen(false);
                }}
                disabled={isLoading || !isConfigComplete}
                className={`flex-1 px-3 py-1 text-xs font-semibold rounded-md text-white transition-colors shadow-2xs ${
                  isLoading || !isConfigComplete
                    ? 'bg-blue-400 dark:bg-blue-800/60 cursor-not-allowed opacity-80'
                    : 'bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500'
                }`}
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>

              <button
                type="button"
                onClick={onForgetToken}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap shadow-2xs"
              >
                Forget
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};


