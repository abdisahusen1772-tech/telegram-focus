'use client';

import React, { useState } from 'react';
import { Share2, Search, X, Check, Users, Radio, Loader2 } from 'lucide-react';
import { ApprovedContact, ApprovedChannel, Message } from '@/lib/types';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageToForward: Message | null;
  contacts: ApprovedContact[];
  channels: ApprovedChannel[];
  onForwardSuccess?: (targetPeerId: string, targetName: string) => void;
}

export function ForwardModal({
  isOpen,
  onClose,
  messageToForward,
  contacts,
  channels,
  onForwardSuccess,
}: ForwardModalProps) {
  const [search, setSearch] = useState('');
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);
  const [forwardSuccess, setForwardSuccess] = useState<string | null>(null);

  if (!isOpen || !messageToForward) return null;

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('tg_focus_session');
    if (token) headers['x-telegram-session'] = token;
    const localApiId = localStorage.getItem('tg_api_id');
    const localApiHash = localStorage.getItem('tg_api_hash');
    if (localApiId) headers['x-telegram-api-id'] = localApiId;
    if (localApiHash) headers['x-telegram-api-hash'] = localApiHash;
    const savedUser = localStorage.getItem('tg_focus_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.userId) headers['x-telegram-user-id'] = u.userId;
        if (u.firstName) headers['x-telegram-first-name'] = encodeURIComponent(u.firstName);
        if (u.phone) headers['x-telegram-phone'] = u.phone;
        if (u.username) headers['x-telegram-username'] = u.username;
      } catch {}
    }
    return headers;
  };

  const handleForward = async (targetId: string, targetName: string) => {
    setForwardingTo(targetId);
    try {
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          action: 'forward',
          messageId: messageToForward.id,
          targetPeerId: targetId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setForwardSuccess(targetName);
        setTimeout(() => {
          setForwardSuccess(null);
          setForwardingTo(null);
          if (onForwardSuccess) onForwardSuccess(targetId, targetName);
          onClose();
        }, 1000);
      } else {
        alert(data.error || 'Failed to forward message');
        setForwardingTo(null);
      }
    } catch (err) {
      console.error('Forward error:', err);
      alert('Network error forwarding message');
      setForwardingTo(null);
    }
  };

  const q = search.toLowerCase().trim();
  const filteredContacts = contacts.filter(
    (c) =>
      !q ||
      c.firstName.toLowerCase().includes(q) ||
      (c.lastName && c.lastName.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q))
  );
  const filteredChannels = channels.filter(
    (ch) => !q || ch.title.toLowerCase().includes(q) || (ch.username && ch.username.toLowerCase().includes(q))
  );

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200/90 w-full max-w-sm rounded-2xl shadow-2xl p-5 text-stone-900 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-stone-900">Forward Message</h2>
              <p className="text-[10px] text-stone-400 font-mono">Select recipient</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message snippet preview */}
        <div className="my-3 p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 text-xs text-stone-600 line-clamp-2 italic">
          "{messageToForward.text || messageToForward.media?.name || 'Media attachment'}"
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts or channels..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-800 transition font-sans"
          />
        </div>

        {/* Success toast */}
        {forwardSuccess && (
          <div className="mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2 animate-in zoom-in-95">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Forwarded to {forwardSuccess}!</span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Contacts */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 px-1 font-semibold">
              Contacts ({filteredContacts.length})
            </span>
            <div className="mt-1 space-y-1">
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-stone-400 italic px-2 py-1">No contacts found</p>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    disabled={Boolean(forwardingTo)}
                    onClick={() => handleForward(c.id, `${c.firstName} ${c.lastName || ''}`.trim())}
                    className="w-full p-2 rounded-xl hover:bg-stone-50 flex items-center justify-between transition cursor-pointer border border-transparent hover:border-stone-200 text-left"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-semibold shrink-0 uppercase">
                        {c.firstName ? c.firstName[0] : 'U'}
                      </div>
                      <span className="text-xs font-medium text-stone-800 truncate">
                        {c.firstName} {c.lastName || ''}
                      </span>
                    </div>
                    {forwardingTo === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono text-sky-600 px-2 py-0.5 rounded-full bg-sky-50 font-medium">
                        Send
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Channels & Groups */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 px-1 font-semibold">
              Channels & Groups ({filteredChannels.length})
            </span>
            <div className="mt-1 space-y-1">
              {filteredChannels.length === 0 ? (
                <p className="text-xs text-stone-400 italic px-2 py-1">No channels or groups found</p>
              ) : (
                filteredChannels.map((ch) => (
                  <button
                    key={ch.id}
                    disabled={Boolean(forwardingTo)}
                    onClick={() => handleForward(ch.id, ch.title)}
                    className="w-full p-2 rounded-xl hover:bg-stone-50 flex items-center justify-between transition cursor-pointer border border-transparent hover:border-stone-200 text-left"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                        {ch.isGroup ? <Users className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-medium text-stone-800 truncate">{ch.title}</span>
                    </div>
                    {forwardingTo === ch.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono text-sky-600 px-2 py-0.5 rounded-full bg-sky-50 font-medium">
                        Post
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
