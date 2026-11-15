'use client';

import React from 'react';
import { Plus, Pin, Trash2, UserMinus, Radio, Users, Layers, ShieldCheck, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
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
  // Sort channels: Pinned first, then alphabetically
  const sortedChannels = [...channels].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.title.localeCompare(b.title);
  });

  // Sort contacts: Pinned first, then unread messages, then alphabetically
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const aUnread = a.status === 'new_message' || (a.unreadCount && a.unreadCount > 0);
    const bUnread = b.status === 'new_message' || (b.unreadCount && b.unreadCount > 0);
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;
    return a.firstName.localeCompare(b.firstName);
  });

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 max-w-md mx-auto w-full flex flex-col justify-between select-none">
      <div>
        {/* Brand & Focus Header with Official App Emblem */}
        <header className="text-center pt-2 pb-6">
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 rounded-full blur-xs opacity-50 group-hover:opacity-80 transition duration-300"></div>
              <img
                src="/app-icon.png"
                alt="Telegram Focus Emblem"
                className="relative w-16 h-16 rounded-full object-cover border-2 border-cyan-400/80 shadow-md group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 mt-2.5">
              Telegram Focus
            </h1>
            <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-sky-600 font-semibold mt-0.5">
              PLAN • FOCUS • ACHIEVE
            </p>

            {/* Telegram Account Connection Indicator */}
            {session && session.isConnected ? (
              <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-medium truncate max-w-[200px]">
                  {session.firstName || session.phone || 'Telegram Account'}
                </span>
              </div>
            ) : (
              onOpenConnectModal && (
                <div className="mt-2.5">
                  <button
                    onClick={onOpenConnectModal}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium transition shadow-xs cursor-pointer animate-pulse"
                    title="Connect your Telegram phone number"
                  >
                    <span>⚡ Connect Telegram Account</span>
                  </button>
                </div>
              )
            )}
          </div>

          <div className="mt-3.5 flex items-center justify-center space-x-2 flex-wrap gap-y-1.5">
            <button
              onClick={onOpenFocusModal}
              className={`text-[10px] font-mono tracking-wider px-3 py-1 rounded-full cursor-pointer transition-all duration-200 border flex items-center space-x-1.5 shadow-2xs ${
                focusMode
                  ? 'bg-stone-900 text-stone-100 border-stone-900 hover:bg-stone-800'
                  : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${focusMode ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'}`} />
              <span>{focusMode ? 'FOCUS ACTIVE' : 'STANDARD'}</span>
            </button>

            {onOpenThemeModal && (
              <button
                onClick={onOpenThemeModal}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-stone-300 hover:border-stone-500 bg-white hover:bg-stone-50 transition cursor-pointer text-stone-700 shadow-2xs flex items-center space-x-1"
                title="Change Interface Theme"
              >
                <span>🎨</span>
                <span>{themeName || 'Theme'}</span>
              </button>
            )}

            {onOpenStoryModal && (
              <button
                onClick={onOpenStoryModal}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-stone-300 hover:border-stone-500 bg-white hover:bg-stone-50 transition cursor-pointer text-stone-700 shadow-2xs flex items-center space-x-1"
                title="Post to Telegram Story"
              >
                <span>📸</span>
                <span>Story</span>
              </button>
            )}
          </div>
        </header>

        {/* 1. Channels Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between border-b border-stone-300 pb-2 mb-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-mono tracking-widest uppercase text-stone-600 font-semibold">
                Channels & Groups
              </span>
              <span className="text-[10px] font-mono text-stone-400">({channels.length})</span>
            </div>
            <button
              onClick={() => onOpenAddModal('channel')}
              className="text-[11px] font-mono text-stone-500 hover:text-stone-950 flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-stone-100 transition cursor-pointer"
              title="Add approved channel or private group"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-1">
            {sortedChannels.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-stone-200 rounded-lg">
                <p className="text-xs text-stone-400 font-mono">
                  No approved channels or groups.
                </p>
                <button
                  onClick={() => onOpenAddModal('channel')}
                  className="mt-1.5 text-xs text-stone-700 underline font-mono hover:text-stone-950 cursor-pointer"
                >
                  + Add from Telegram
                </button>
              </div>
            ) : (
              sortedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white hover:shadow-2xs transition-all duration-150 group border cursor-pointer ${
                    channel.isPinned
                      ? 'border-amber-300/70 bg-amber-50/30'
                      : 'border-transparent hover:border-stone-200/80'
                  }`}
                  onClick={() => onSelectChannel(channel)}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {channel.isPinned && (
                      <span className="text-[10px] text-amber-600 font-mono shrink-0" title="Pinned to top">
                        📌
                      </span>
                    )}
                    <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center text-stone-500 shrink-0">
                      {channel.isGroup ? <Users className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-sm font-medium text-stone-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-150 truncate">
                      {channel.title}
                    </span>
                    {channel.isGroup && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-600 border border-sky-200 shrink-0">
                        Topics
                      </span>
                    )}
                    {channel.isPrivate && !channel.isGroup && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 border border-stone-200 shrink-0">
                        Private
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {channel.hasNewPost && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs"
                        title="New post available"
                      />
                    )}

                    {onTogglePinChannel && (
                      <button
                        onClick={() => onTogglePinChannel(channel.id)}
                        className={`p-1 rounded hover:bg-stone-200/60 transition cursor-pointer ${
                          channel.isPinned
                            ? 'text-amber-600 opacity-100'
                            : 'text-stone-300 hover:text-stone-600 opacity-0 group-hover:opacity-100'
                        }`}
                        title={channel.isPinned ? 'Unpin channel' : 'Pin to top'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${channel.isPinned ? 'fill-amber-600' : ''}`} />
                      </button>
                    )}

                    {onRemoveChannel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Remove "${channel.title}" from approved channels?`)) {
                            onRemoveChannel(channel.id);
                          }
                        }}
                        className="p-1 rounded text-stone-300 hover:text-red-600 hover:bg-stone-200/60 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="Remove channel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 2. Contacts Section */}
        <section className="mb-6">
          <div className="flex items-center justify-between border-b border-stone-300 pb-2 mb-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-mono tracking-widest uppercase text-stone-600 font-semibold">
                Contacts
              </span>
              <span className="text-[10px] font-mono text-stone-400">({contacts.length})</span>
            </div>
            <button
              onClick={() => onOpenAddModal('contact')}
              className="text-[11px] font-mono text-stone-500 hover:text-stone-950 flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-stone-100 transition cursor-pointer"
              title="Add approved contact by @username"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-1">
            {sortedContacts.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-stone-200 rounded-lg">
                <p className="text-xs text-stone-400 font-mono">
                  No approved contacts.
                </p>
                <button
                  onClick={() => onOpenAddModal('contact')}
                  className="mt-1.5 text-xs text-stone-700 underline font-mono hover:text-stone-950 cursor-pointer"
                >
                  + Add by @username
                </button>
              </div>
            ) : (
              sortedContacts.map((contact) => {
                const hasNew = contact.status === 'new_message' || (contact.unreadCount && contact.unreadCount > 0);
                return (
                  <div
                    key={contact.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white hover:shadow-2xs transition-all duration-150 group border cursor-pointer ${
                      contact.isPinned
                        ? 'border-amber-300/70 bg-amber-50/30'
                        : 'border-transparent hover:border-stone-200/80'
                    }`}
                    onClick={() => onSelectContact(contact)}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {contact.isPinned && (
                        <span className="text-[10px] text-amber-600 font-mono shrink-0" title="Pinned to top">
                          📌
                        </span>
                      )}
                      <div className="w-6 h-6 rounded-full bg-stone-200/80 text-stone-700 flex items-center justify-center text-xs font-semibold shrink-0 uppercase">
                        {contact.firstName ? contact.firstName[0] : 'U'}
                      </div>
                      <span className="text-sm font-medium text-stone-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-150 truncate">
                        {contact.firstName} {contact.lastName || ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Pin button */}
                      {onTogglePinContact && (
                        <button
                          onClick={() => onTogglePinContact(contact.id)}
                          className={`p-1 rounded hover:bg-stone-200/60 transition cursor-pointer ${
                            contact.isPinned
                              ? 'text-amber-600 opacity-100'
                              : 'text-stone-300 hover:text-stone-600 opacity-0 group-hover:opacity-100'
                          }`}
                          title={contact.isPinned ? 'Unpin contact' : 'Pin to top'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${contact.isPinned ? 'fill-amber-600' : ''}`} />
                        </button>
                      )}

                      {/* Remove / Unadd Contact button */}
                      {onRemoveContact && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const name = `${contact.firstName} ${contact.lastName || ''}`.trim();
                            if (window.confirm(`Remove ${name} from approved contacts?`)) {
                              onRemoveContact(contact.id);
                            }
                          }}
                          className="p-1 rounded text-stone-300 hover:text-red-600 hover:bg-stone-200/60 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Remove / unadd contact"
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
      </div>

      {/* Reassuring Footer Quote */}
      <footer className="text-center pt-4 pb-2 border-t border-stone-200/60">
        <p className="text-[11px] font-mono text-stone-400 tracking-wide">
          Stay connected without getting distracted.
        </p>
      </footer>
    </div>
  );
}
