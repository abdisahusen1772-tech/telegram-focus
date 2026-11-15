'use client';

import React, { useState } from 'react';
import {
  Plus,
  Pin,
  Trash2,
  UserMinus,
  Radio,
  Users,
  Search,
  Sparkles,
  Camera,
  Palette,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { ApprovedContact, ApprovedChannel, UserSession } from '@/lib/types';

interface HomeScreenProps {
  channels: ApprovedChannel[];
  contacts: ApprovedContact[];
  onSelectChannel: (channel: ApprovedChannel) => void;
  onSelectContact: (contact: ApprovedContact) => void;
  onOpenAddModal: (type: 'contact' | 'channel') => void;
  onTogglePinChannel?: (id: string) => void;
  onTogglePinContact?: (id: string) => void;
  onRemoveContact?: (id: string) => void;
  onRemoveChannel?: (id: string) => void;
  onSimulateIncoming?: (peerId: string) => void;
  focusMode: boolean;
  onOpenFocusModal: () => void;
  onOpenThemeModal?: () => void;
  onOpenStoryModal?: () => void;
  themeName?: string;
  session?: UserSession | null;
  onOpenConnectModal?: () => void;
}

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

export function HomeScreen({
  channels,
  contacts,
  onSelectChannel,
  onSelectContact,
  onOpenAddModal,
  onTogglePinChannel,
  onTogglePinContact,
  onRemoveContact,
  onRemoveChannel,
  focusMode,
  onOpenFocusModal,
  onOpenThemeModal,
  onOpenStoryModal,
  themeName,
  session,
  onOpenConnectModal,
}: HomeScreenProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [segmentTab, setSegmentTab] = useState<'all' | 'channels' | 'contacts'>('all');

  const q = searchFilter.toLowerCase().trim();

  // Sort channels: Pinned first, then alphabetically
  const sortedChannels = [...channels]
    .filter((ch) => !q || ch.title.toLowerCase().includes(q) || (ch.username && ch.username.toLowerCase().includes(q)))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.title.localeCompare(b.title);
    });

  // Sort contacts: Pinned first, then unread messages, then alphabetically
  const sortedContacts = [...contacts]
    .filter((c) => !q || `${c.firstName} ${c.lastName || ''}`.toLowerCase().includes(q) || (c.username && c.username.toLowerCase().includes(q)))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aUnread = a.status === 'new_message' || (a.unreadCount && a.unreadCount > 0);
      const bUnread = b.status === 'new_message' || (b.unreadCount && b.unreadCount > 0);
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      return a.firstName.localeCompare(b.firstName);
    });

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-md mx-auto w-full flex flex-col justify-between select-none">
      <div>
        {/* Brand & Focus Header with Official App Emblem */}
        <header className="text-center pt-1 pb-5">
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 rounded-full blur-xs opacity-60 group-hover:opacity-90 transition duration-300 animate-pulse"></div>
              <img
                src="/app-icon.png"
                alt="Telegram Focus"
                className="relative w-16 h-16 rounded-full object-cover border-2 border-white/80 dark:border-white/20 shadow-xl group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-2.5">
              Telegram Focus
            </h1>
            <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-sky-600 dark:text-sky-400 font-semibold mt-0.5">
              PLAN • FOCUS • ACHIEVE
            </p>

            {/* Telegram Account Connection Status Badge */}
            {session && session.isConnected ? (
              <div className="mt-2 inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono shadow-xs backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-medium truncate max-w-[200px]">
                  {session.firstName || session.phone || 'Connected'}
                </span>
              </div>
            ) : (
              onOpenConnectModal && (
                <div className="mt-2.5">
                  <button
                    onClick={onOpenConnectModal}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium transition shadow-md cursor-pointer animate-pulse"
                    title="Connect your Telegram account"
                  >
                    <span>⚡ Connect Telegram Account</span>
                  </button>
                </div>
              )
            )}
          </div>

          {/* Action Capsules Bar */}
          <div className="mt-3.5 flex items-center justify-center space-x-2 flex-wrap gap-y-1.5">
            {/* Focus Mode Pill */}
            <button
              onClick={onOpenFocusModal}
              className={`text-[10px] font-mono tracking-wider px-3 py-1 rounded-full cursor-pointer transition-all duration-200 border flex items-center space-x-1.5 shadow-xs ${
                focusMode
                  ? 'bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 border-stone-800'
                  : 'bg-white/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300/80 hover:bg-stone-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${focusMode ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'}`} />
              <span>{focusMode ? 'FOCUS ON' : 'FOCUS OFF'}</span>
            </button>

            {/* Story Button */}
            {onOpenStoryModal && (
              <button
                onClick={onOpenStoryModal}
                className="text-[10px] font-mono px-3 py-1 rounded-full border border-sky-300/60 dark:border-sky-700/60 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 transition cursor-pointer shadow-xs flex items-center space-x-1"
                title="Post to Telegram Story"
              >
                <Camera className="w-3 h-3" />
                <span>Story</span>
              </button>
            )}

            {/* Theme Selector */}
            {onOpenThemeModal && (
              <button
                onClick={onOpenThemeModal}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-stone-300/80 dark:border-stone-700 bg-white/80 dark:bg-stone-800/80 hover:bg-white text-stone-700 dark:text-stone-300 transition cursor-pointer shadow-xs flex items-center space-x-1"
                title="Change Interface Theme"
              >
                <Palette className="w-3 h-3 text-stone-500" />
                <span>{themeName || 'Theme'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Quick Search & Segment Filter Bar */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search channels, groups, contacts..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/70 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:border-sky-500 transition shadow-2xs placeholder:text-stone-400"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Segment Toggle */}
          <div className="flex bg-stone-200/50 dark:bg-stone-800/50 p-0.5 rounded-lg text-[11px] font-mono">
            <button
              onClick={() => setSegmentTab('all')}
              className={`flex-1 py-1 rounded-md transition cursor-pointer ${
                segmentTab === 'all'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              All ({channels.length + contacts.length})
            </button>
            <button
              onClick={() => setSegmentTab('channels')}
              className={`flex-1 py-1 rounded-md transition cursor-pointer ${
                segmentTab === 'channels'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Channels ({channels.length})
            </button>
            <button
              onClick={() => setSegmentTab('contacts')}
              className={`flex-1 py-1 rounded-md transition cursor-pointer ${
                segmentTab === 'contacts'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Contacts ({contacts.length})
            </button>
          </div>
        </div>

        {/* 1. Channels Section */}
        {(segmentTab === 'all' || segmentTab === 'channels') && (
          <section className="mb-6">
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-mono tracking-widest uppercase text-stone-500 font-semibold">
                  Channels & Groups
                </span>
                <span className="text-[10px] font-mono text-stone-400">({channels.length})</span>
              </div>
              <button
                onClick={() => onOpenAddModal('channel')}
                className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center space-x-1 px-2 py-0.5 rounded-md hover:bg-sky-50 dark:hover:bg-stone-800 transition cursor-pointer"
                title="Add approved channel or group"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {sortedChannels.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl bg-white/40 dark:bg-stone-900/40">
                  <p className="text-xs text-stone-400 font-mono">
                    {q ? `No channels matching "${q}".` : 'No approved channels or groups.'}
                  </p>
                  <button
                    onClick={() => onOpenAddModal('channel')}
                    className="mt-1.5 text-xs text-sky-600 dark:text-sky-400 underline font-mono cursor-pointer"
                  >
                    + Add from Telegram
                  </button>
                </div>
              ) : (
                sortedChannels.map((channel) => {
                  const gradient = getAvatarGradient(channel.title);
                  return (
                    <div
                      key={channel.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-150 group border cursor-pointer active:scale-[0.99] ${
                        channel.isPinned
                          ? 'border-amber-300/60 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs'
                          : 'border-stone-200/80 dark:border-stone-800/80 bg-white/80 dark:bg-stone-900/60 hover:border-stone-300 hover:shadow-xs'
                      }`}
                      onClick={() => onSelectChannel(channel)}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        {/* Colored Initials Avatar */}
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                        >
                          {channel.isGroup ? (
                            <Users className="w-4 h-4" />
                          ) : (
                            channel.title.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            {channel.isPinned && (
                              <span className="text-[10px] text-amber-500 font-mono shrink-0" title="Pinned">
                                📌
                              </span>
                            )}
                            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 tracking-tight truncate">
                              {channel.title}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[11px] text-stone-400 dark:text-stone-500 font-mono truncate">
                              {channel.username ? `@${channel.username}` : (channel.isGroup ? 'Group' : 'Channel')}
                            </span>
                            {channel.isGroup && (
                              <span className="text-[9px] font-mono px-1 rounded bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                                Topics
                              </span>
                            )}
                            {channel.isPrivate && (
                              <span className="text-[9px] font-mono px-1 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 border border-stone-200 dark:border-stone-700">
                                Private
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {channel.hasNewPost && (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-xs animate-pulse"
                            title="New post"
                          />
                        )}

                        {onTogglePinChannel && (
                          <button
                            onClick={() => onTogglePinChannel(channel.id)}
                            className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer ${
                              channel.isPinned
                                ? 'text-amber-500'
                                : 'text-stone-300 hover:text-stone-600 opacity-0 group-hover:opacity-100'
                            }`}
                            title={channel.isPinned ? 'Unpin channel' : 'Pin channel to top'}
                          >
                            <Pin className={`w-3.5 h-3.5 ${channel.isPinned ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}

                        {onRemoveChannel && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Remove "${channel.title}" from approved list?`)) {
                                onRemoveChannel(channel.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Remove channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* 2. Contacts Section */}
        {(segmentTab === 'all' || segmentTab === 'contacts') && (
          <section className="mb-6">
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-mono tracking-widest uppercase text-stone-500 font-semibold">
                  Contacts
                </span>
                <span className="text-[10px] font-mono text-stone-400">({contacts.length})</span>
              </div>
              <button
                onClick={() => onOpenAddModal('contact')}
                className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center space-x-1 px-2 py-0.5 rounded-md hover:bg-sky-50 dark:hover:bg-stone-800 transition cursor-pointer"
                title="Add approved contact"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {sortedContacts.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl bg-white/40 dark:bg-stone-900/40">
                  <p className="text-xs text-stone-400 font-mono">
                    {q ? `No contacts matching "${q}".` : 'No approved contacts.'}
                  </p>
                  <button
                    onClick={() => onOpenAddModal('contact')}
                    className="mt-1.5 text-xs text-sky-600 dark:text-sky-400 underline font-mono cursor-pointer"
                  >
                    + Add by @username
                  </button>
                </div>
              ) : (
                sortedContacts.map((contact) => {
                  const hasNew = contact.status === 'new_message' || (contact.unreadCount && contact.unreadCount > 0);
                  const fullName = `${contact.firstName} ${contact.lastName || ''}`.trim();
                  const gradient = getAvatarGradient(fullName);

                  return (
                    <div
                      key={contact.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-150 group border cursor-pointer active:scale-[0.99] ${
                        contact.isPinned
                          ? 'border-amber-300/60 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs'
                          : 'border-stone-200/80 dark:border-stone-800/80 bg-white/80 dark:bg-stone-900/60 hover:border-stone-300 hover:shadow-xs'
                      }`}
                      onClick={() => onSelectContact(contact)}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        {/* Colored Initials Avatar */}
                        <div
                          className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs uppercase`}
                        >
                          {contact.firstName ? contact.firstName.charAt(0) : 'U'}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            {contact.isPinned && (
                              <span className="text-[10px] text-amber-500 font-mono shrink-0" title="Pinned">
                                📌
                              </span>
                            )}
                            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 tracking-tight truncate">
                              {fullName}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-400 dark:text-stone-500 font-mono truncate block mt-0.5">
                            {contact.username ? `@${contact.username}` : 'Direct Contact'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Pin Button */}
                        {onTogglePinContact && (
                          <button
                            onClick={() => onTogglePinContact(contact.id)}
                            className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer ${
                              contact.isPinned
                                ? 'text-amber-500'
                                : 'text-stone-300 hover:text-stone-600 opacity-0 group-hover:opacity-100'
                            }`}
                            title={contact.isPinned ? 'Unpin contact' : 'Pin to top'}
                          >
                            <Pin className={`w-3.5 h-3.5 ${contact.isPinned ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}

                        {/* Remove / Unadd Contact */}
                        {onRemoveContact && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Remove ${fullName} from approved contacts?`)) {
                                onRemoveContact(contact.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-stone-300 hover:text-red-600 hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Remove contact"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Status indicator: 🔵 New message vs ⚪ No new message */}
                        <div
                          onClick={() => onSelectContact(contact)}
                          className="cursor-pointer p-0.5 flex items-center justify-center"
                          title={hasNew ? '🔵 New message from contact' : '⚪ No new message'}
                        >
                          {hasNew ? (
                            <div className="w-3.5 h-3.5 rounded-full indicator-blue shadow-xs" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full indicator-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}
      </div>

      {/* Reassuring Footer Quote */}
      <footer className="text-center pt-4 pb-1 border-t border-stone-200/60 dark:border-stone-800">
        <p className="text-[11px] font-mono text-stone-400 dark:text-stone-500 tracking-wide">
          Stay connected without getting distracted.
        </p>
      </footer>
    </div>
  );
}
