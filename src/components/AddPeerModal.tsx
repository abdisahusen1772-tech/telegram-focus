'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, Radio, AlertCircle, CheckCircle2, Loader2, Lock, Users, Plus, Check, Search } from 'lucide-react';

interface AddPeerModalProps {
  isOpen: boolean;
  type: 'contact' | 'channel';
  onClose: () => void;
  onSuccess: (data: unknown) => void;
  onOpenConnectModal?: () => void;
}

interface JoinedDialogItem {
  id: string;
  title: string;
  username?: string;
  isGroup: boolean;
  isChannel: boolean;
  isPrivate: boolean;
  isAlreadyAdded?: boolean;
}

export function AddPeerModal({ isOpen, type, onClose, onSuccess, onOpenConnectModal }: AddPeerModalProps) {
  const [activeTab, setActiveTab] = useState<'username' | 'dialogs'>('username');
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogs, setDialogs] = useState<JoinedDialogItem[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [isNotConnected, setIsNotConnected] = useState(false);
  const [addingDialogId, setAddingDialogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isContact = type === 'contact';
  const title = isContact ? 'Approve Contact' : 'Approve Channel or Private Group';
  const placeholder = isContact ? '@username' : '@examplechannel';
  const helperText = isContact
    ? 'Enter the exact Telegram username of the contact you wish to allow. No contact discovery or general search is permitted.'
    : 'Add public channels by @username or select your joined private channels and groups directly from your connected Telegram account.';

  useEffect(() => {
    if (isOpen && !isContact && activeTab === 'dialogs' && dialogs.length === 0) {
      loadDialogs();
    }
  }, [isOpen, activeTab, isContact]);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('tg_focus_session');
    return token ? { 'x-telegram-session': token } : {};
  };

  const loadDialogs = async () => {
    setLoadingDialogs(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/dialogs', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.notConnected) {
        setIsNotConnected(true);
      } else if (data.success && Array.isArray(data.dialogs)) {
        setIsNotConnected(false);
        setDialogs(data.dialogs);
      }
    } catch (err) {
      console.error('Failed to load Telegram dialogs:', err);
    } finally {
      setLoadingDialogs(false);
    }
  };

  if (!isOpen) return null;

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
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
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

  const handleAddDialog = async (d: JoinedDialogItem) => {
    setAddingDialogId(d.id);
    setError(null);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: d.id,
          title: d.title,
          username: d.username,
          isGroup: d.isGroup,
          isPrivate: d.isPrivate,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add private group/channel');
      }

      setDialogs((prev) =>
        prev.map((item) => (item.id === d.id ? { ...item, isAlreadyAdded: true } : item))
      );
      setSuccessMsg(`Added "${d.title}" to Approved list`);
      setTimeout(() => {
        onSuccess(data);
        onClose();
        setSuccessMsg(null);
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add group');
    } finally {
      setAddingDialogId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-sm rounded-lg shadow-xl p-6 text-stone-900 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 shrink-0">
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

        {/* Tab Switcher for Channels & Groups */}
        {!isContact && (
          <div className="flex border-b border-stone-200 mt-2 shrink-0">
            <button
              onClick={() => setActiveTab('username')}
              className={`flex-1 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === 'username'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              By @Username
            </button>
            <button
              onClick={() => {
                setActiveTab('dialogs');
                if (dialogs.length === 0) loadDialogs();
              }}
              className={`flex-1 py-2 text-xs font-medium border-b-2 transition flex items-center justify-center space-x-1 ${
                activeTab === 'dialogs'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              <span>My Telegram Groups</span>
              <Lock className="w-3 h-3 ml-0.5 opacity-60" />
            </button>
          </div>
        )}

        {/* Tab 1: Username Form */}
        {activeTab === 'username' && (
          <form onSubmit={handleSubmit} className="pt-4 space-y-4 overflow-y-auto">
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
        )}

        {/* Tab 2: Joined Private Channels & Groups */}
        {!isContact && activeTab === 'dialogs' && (
          <div className="pt-3 space-y-3 flex-1 overflow-y-auto">
            {/* Search Input for Joined Channels & Groups */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your channels & groups by name..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-800 transition placeholder:text-stone-400 font-sans"
              />
            </div>

            {isNotConnected ? (
              <div className="py-6 px-3 text-center space-y-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-900">
                  Telegram Account Not Connected
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed font-sans">
                  Please connect your Telegram account first to load and search your actual joined groups and channels.
                </p>
                {onOpenConnectModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenConnectModal();
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-900 text-white hover:bg-amber-800 rounded-lg transition cursor-pointer shadow-xs"
                  >
                    Connect Telegram Account →
                  </button>
                )}
              </div>
            ) : loadingDialogs ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading your joined groups...</span>
              </div>
            ) : dialogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-500 font-sans space-y-2">
                <p>No joined channels or groups found in your Telegram account.</p>
                <button
                  type="button"
                  onClick={loadDialogs}
                  className="text-[11px] font-mono text-stone-700 underline hover:text-black cursor-pointer"
                >
                  ↻ Refresh Telegram Groups
                </button>
              </div>
            ) : (() => {
              const q = searchQuery.toLowerCase().trim();
              const filtered = dialogs.filter((d) =>
                !q ? true : d.title.toLowerCase().includes(q) || (d.username && d.username.toLowerCase().includes(q))
              );

              if (filtered.length === 0) {
                return (
                  <div className="py-6 text-center text-xs text-stone-400 font-mono">
                    No channels or groups found matching &ldquo;{searchQuery}&rdquo;.
                  </div>
                );
              }

              return (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filtered.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 bg-white border border-stone-200 rounded-lg flex items-center justify-between hover:border-stone-300 transition"
                    >
                      <div className="overflow-hidden flex-1 mr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-medium text-stone-900 truncate">
                            {d.title}
                          </span>
                          {d.isPrivate && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-stone-400 font-mono mt-0.5">
                          <span>{d.isGroup ? 'Group' : 'Channel'}</span>
                          {d.username && <span>@{d.username}</span>}
                        </div>
                      </div>

                      {d.isAlreadyAdded ? (
                        <span className="text-[10px] font-mono text-emerald-600 flex items-center space-x-1 shrink-0 px-2 py-1 bg-emerald-50 rounded">
                          <Check className="w-3 h-3" />
                          <span>Added</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddDialog(d)}
                          disabled={addingDialogId === d.id}
                          className="px-2.5 py-1 text-[11px] font-medium bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 rounded flex items-center space-x-1 shrink-0 cursor-pointer transition shadow-2xs"
                        >
                          {addingDialogId === d.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs">
                {successMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
