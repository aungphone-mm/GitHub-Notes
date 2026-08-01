import React, { useState } from 'react';
import { AppConfig } from '../types';
import {
  Github, Sun, Moon, Settings, ChevronDown, ChevronUp, CheckCircle2,
  AlertTriangle, X, Sparkles, FileText, Calendar, TrendingUp, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

const PAT_WARNING_KEY = 'gh_notes_pat_warning_dismissed';

interface SettingsFormProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onForgetToken: () => void;
  onConnect: () => void;
  onConnected: () => void;
  isLoading: boolean;
  isConfigComplete: boolean;
}

const SettingsForm: React.FC<SettingsFormProps> = ({
  config, onUpdateConfig, onForgetToken, onConnect, onConnected, isLoading, isConfigComplete
}) => {
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
    onUpdateConfig({ ...config, [field]: value });
  };

  return (
    <div className="space-y-2.5">
      {!isWarningDismissed && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-lg px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-bold">Security note:</span> Token &amp; settings are stored in browser{' '}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded text-[10px]">localStorage</code>.{' '}
            Don't use on shared computers. Use a{' '}
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100"
            >
              fine-grained PAT
            </a>{' '}
            scoped to <em>Contents: Read &amp; Write</em> on a single repo.
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

      <div className="grid grid-cols-1 gap-2.5">
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

        <div>
          <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
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

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onConnect();
              if (isConfigComplete) onConnected();
            }}
            disabled={isLoading || !isConfigComplete}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md text-white transition-colors shadow-2xs ${
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
            className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap shadow-2xs"
          >
            Forget
          </button>
        </div>
      </div>
    </div>
  );
};

interface SidebarProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onForgetToken: () => void;
  onConnect: () => void;
  isLoading: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeView: 'editor' | 'calendar' | 'habits';
  onChangeView: (view: 'editor' | 'calendar' | 'habits') => void;
  contextLabel: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  config,
  onUpdateConfig,
  onForgetToken,
  onConnect,
  isLoading,
  theme,
  onToggleTheme,
  activeView,
  onChangeView,
  contextLabel
}) => {
  const isConfigComplete = Boolean(config.owner && config.repo && config.token);
  const [isSettingsOpen, setIsSettingsOpen] = useState(!isConfigComplete);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: { key: 'editor' | 'calendar' | 'habits'; label: string; icon: React.ReactNode }[] = [
    { key: 'editor', label: 'Notes Workspace', icon: <FileText className="w-4 h-4" /> },
    { key: 'calendar', label: 'Calendar View', icon: <Calendar className="w-4 h-4" /> },
    { key: 'habits', label: 'Habit Tracker', icon: <TrendingUp className="w-4 h-4 text-emerald-500" /> }
  ];

  return (
    <>
      {/* Mobile Top Bar (compact, replaces old header on small screens) */}
      <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center justify-between gap-2 shrink-0 z-20 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Github className="w-5 h-5 text-gray-900 dark:text-gray-100 shrink-0" />
          <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight font-sans truncate">
            GitHub Notes
          </h1>
          {isConfigComplete && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] font-mono text-gray-700 dark:text-gray-300 shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[8rem]">
                {config.owner}/{config.repo}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 border ${
              isMobileMenuOpen
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            {isMobileMenuOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors"
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

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-3 shrink-0 z-20">
          <SettingsForm
            config={config}
            onUpdateConfig={onUpdateConfig}
            onForgetToken={onForgetToken}
            onConnect={onConnect}
            onConnected={() => setIsMobileMenuOpen(false)}
            isLoading={isLoading}
            isConfigComplete={isConfigComplete}
          />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col h-full shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all z-20 ${
          isCollapsed ? 'md:w-16' : 'md:w-72'
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-gray-800 ${isCollapsed ? 'justify-center' : ''}`}>
          <Github className="w-5 h-5 text-gray-900 dark:text-gray-100 shrink-0" />
          {!isCollapsed && (
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight font-sans truncate">
              GitHub Notes
            </h1>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="ml-auto p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && isConfigComplete && (
          <div className="px-3 pt-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-700 dark:text-gray-300 w-fit max-w-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {config.owner}/{config.repo}
              </span>
              <span className="text-gray-400 shrink-0">({config.branch || 'main'})</span>
            </div>
          </div>
        )}

        {/* Scrollable content: nav + settings */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          {/* View Switcher Nav */}
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => onChangeView(item.key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  activeView === item.key
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={item.label}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {!isCollapsed && (
            <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 px-2.5 select-none">
              {contextLabel}
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(prev => !prev)}
              className={`w-full px-2.5 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2 border ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isSettingsOpen
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Configure repository credentials"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Settings</span>
                  {isSettingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </>
              )}
            </button>

            {!isCollapsed && isSettingsOpen && (
              <div className="mt-2.5">
                <SettingsForm
                  config={config}
                  onUpdateConfig={onUpdateConfig}
                  onForgetToken={onForgetToken}
                  onConnect={onConnect}
                  onConnected={() => setIsSettingsOpen(false)}
                  isLoading={isLoading}
                  isConfigComplete={isConfigComplete}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer: shortcuts + theme */}
        <div className={`border-t border-gray-100 dark:border-gray-800 px-2 py-2.5 flex items-center gap-2 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="text-[10px] font-mono text-gray-400 dark:text-gray-500 select-none truncate">
              Ctrl+S: Save | Ctrl+Enter: New
            </div>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors shrink-0"
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
      </aside>
    </>
  );
};
