'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  isOffline: boolean;
  lastSynced: string;
  onSync: () => void;
  isSyncing: boolean;
}

export function OfflineBanner({ isOffline, lastSynced, onSync, isSyncing }: OfflineBannerProps) {
  if (!isOffline) return null;

  return (
    <div className="bg-stone-100 border-b border-stone-200 px-4 py-3 text-stone-700 text-xs flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-3.5 h-3.5 text-stone-500" />
        <div>
          <span className="font-semibold text-stone-800">Offline</span>
          <span className="mx-1.5 text-stone-300">•</span>
          <span className="text-stone-500">Last synchronized: {lastSynced || 'Recently'}</span>
        </div>
      </div>
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="text-stone-600 hover:text-stone-900 flex items-center space-x-1 cursor-pointer"
        title="Retry connection"
      >
        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>Sync</span>
      </button>
    </div>
  );
}
