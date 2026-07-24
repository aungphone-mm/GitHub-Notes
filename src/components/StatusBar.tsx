import React from 'react';
import { StatusState } from '../types';
import { AlertCircle, CheckCircle2, Info, Loader2, AlertTriangle } from 'lucide-react';

interface StatusBarProps {
  status: StatusState;
  onClear?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, onClear }) => {
  if (!status.message && status.type === 'idle') return null;

  const bgStyles = {
    idle: 'bg-gray-100 text-gray-700 border-gray-200',
    loading: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200'
  };

  const icons = {
    idle: <Info className="w-4 h-4 text-gray-500 shrink-0" />,
    loading: <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-3 py-2 text-xs border-y flex items-center justify-between gap-2 transition-all ${
        bgStyles[status.type] || bgStyles.idle
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        {icons[status.type]}
        <span className="font-medium">{status.message}</span>
        {status.detail && (
          <span className="font-mono text-[11px] opacity-80 truncate hidden sm:inline">
            ({status.detail})
          </span>
        )}
      </div>

      {onClear && status.type !== 'loading' && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs opacity-60 hover:opacity-100 font-bold px-1 py-0.5 rounded focus:outline-none"
          title="Dismiss status"
        >
          ✕
        </button>
      )}
    </div>
  );
};
