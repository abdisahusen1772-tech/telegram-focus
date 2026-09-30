'use client';

import React from 'react';
import { Check, X, Shield, EyeOff, Radio } from 'lucide-react';

interface FocusModeBannerProps {
  isOpen: boolean;
  onClose: () => void;
  focusMode: boolean;
  onToggleFocus: (enabled: boolean) => void;
}

export function FocusModeBanner({ isOpen, onClose, focusMode, onToggleFocus }: FocusModeBannerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-sm rounded-lg shadow-xl p-6 text-stone-900 relative">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-stone-700" />
            <h2 className="text-sm font-bold tracking-widest uppercase">Focus Mode</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 text-sm font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between bg-stone-100 p-3 rounded border border-stone-200">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-700">Status</p>
              <p className="text-xs text-stone-500">
                {focusMode ? 'Active — Anti-distraction active' : 'Disabled — Standard mode'}
              </p>
            </div>
            <button
              onClick={() => onToggleFocus(!focusMode)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition cursor-pointer ${
                focusMode
                  ? 'bg-stone-900 text-white hover:bg-stone-800'
                  : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
              }`}
            >
              {focusMode ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="bg-white border border-stone-200 rounded p-4 text-xs space-y-3">
            <p className="font-mono text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
              Permitted Features
            </p>
            <div className="space-y-1.5 text-stone-800">
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Approved contacts only</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Approved channels only</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Message notifications</span>
              </div>
              <div className="flex items-center space-x-2">
                <EyeOff className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Previews strictly hidden</span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100"></div>

            <p className="font-mono text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
              Permanently Blocked
            </p>
            <div className="space-y-1.5 text-stone-400">
              <div className="flex items-center space-x-2 line-through">
                <X className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Global search engine</span>
              </div>
              <div className="flex items-center space-x-2 line-through">
                <X className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Recommendations</span>
              </div>
              <div className="flex items-center space-x-2 line-through">
                <X className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Channel & user discovery</span>
              </div>
              <div className="flex items-center space-x-2 line-through">
                <X className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Social feeds & reels</span>
              </div>
              <div className="flex items-center space-x-2 line-through">
                <X className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Stories & engagement metrics</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-stone-900 text-stone-50 text-xs font-medium rounded hover:bg-stone-800 transition cursor-pointer"
        >
          Return to Focus
        </button>
      </div>
    </div>
  );
}
