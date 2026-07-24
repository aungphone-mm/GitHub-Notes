import React from 'react';
import { StatusState } from '../types';
import { Loader2 } from 'lucide-react';

interface StatusBarProps {
  status: StatusState;
  onClear?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, onClear }) => {
  if (!status.message && status.type === 'idle') return null;

  const dotColors = {
    idle: 'bg-gray-400',
    loading: 'bg-blue-500',
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500'
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-2 text-xs font-mono bg-[#f8fafc] border-y border-gray-200 flex items-center justify-between gap-2 text-gray-600 select-none"
    >
      <div className="flex items-center gap-2 overflow-hidden truncate">
        {status.type === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
        ) : (
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColors[status.type] || dotColors.idle}`} />
        )}
        <span className="font-medium truncate">{status.message}</span>
        {status.detail && (
          <span className="text-[11px] opacity-75 truncate hidden sm:inline">
            ({status.detail})
          </span>
        )}
      </div>

      {onClear && status.type !== 'loading' && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs opacity-50 hover:opacity-100 px-1 rounded focus:outline-none"
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
};

