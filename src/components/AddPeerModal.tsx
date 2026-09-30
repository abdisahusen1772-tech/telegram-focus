'use client';

import React, { useState } from 'react';
import { UserPlus, Radio, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface AddPeerModalProps {
  isOpen: boolean;
  type: 'contact' | 'channel';
  onClose: () => void;
  onSuccess: (data: unknown) => void;
}

export function AddPeerModal({ isOpen, type, onClose, onSuccess }: AddPeerModalProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isContact = type === 'contact';
  const title = isContact ? 'Approve Contact' : 'Approve Channel';
  const placeholder = isContact ? '@username' : '@examplechannel';
  const helperText = isContact
    ? 'Enter the exact Telegram username of the contact you wish to allow. No contact discovery or general search is permitted.'
    : 'Enter the exact Telegram username of the channel you wish to allow. No channel discovery, trending lists, or recommendations.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim();
    if (!clean) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const endpoint = isContact ? '/api/contacts' : '/api/channels';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify on Telegram');
      }

      setSuccessMsg(data.message || `Successfully added ${clean}`);
      setTimeout(() => {
        onSuccess(data);
        onClose();
        setUsername('');
        setSuccessMsg(null);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error verifying entity';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-sm rounded-lg shadow-xl p-6 text-stone-900">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            {isContact ? <UserPlus className="w-4 h-4 text-stone-700" /> : <Radio className="w-4 h-4 text-stone-700" />}
            <h2 className="text-sm font-semibold tracking-wide text-stone-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 text-sm font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
          <p className="text-xs text-stone-500 leading-relaxed">
            {helperText}
          </p>

          <div>
            <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
              Telegram Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={placeholder}
              required
              autoFocus
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded font-mono focus:outline-none focus:border-stone-800 transition"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-medium text-stone-600 bg-stone-200 hover:bg-stone-300 rounded transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="flex-1 py-2 text-xs font-medium text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Verifying...' : 'Approve'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
