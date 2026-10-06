'use client';

import React from 'react';
import { Plus, Shield, Sparkles, Radio, MessageSquare, Check, Bell } from 'lucide-react';
import { ApprovedContact, ApprovedChannel } from '@/lib/types';

interface HomeScreenProps {
  channels: ApprovedChannel[];
  contacts: ApprovedContact[];
  onSelectChannel: (channel: ApprovedChannel) => void;
  onSelectContact: (contact: ApprovedContact) => void;
  onOpenAddModal: (type: 'contact' | 'channel') => void;
  onSimulateIncoming: (peerId: string) => void;
  focusMode: boolean;
  onOpenFocusModal: () => void;
  onOpenThemeModal?: () => void;
  themeName?: string;
}

export function HomeScreen({
  channels,
  contacts,
  onSelectChannel,
  onSelectContact,
  onOpenAddModal,
  onSimulateIncoming,
  focusMode,
  onOpenFocusModal,
  onOpenThemeModal,
  themeName,
}: HomeScreenProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 max-w-md mx-auto w-full flex flex-col justify-between select-none">
      <div>
        {/* Brand & Focus Header */}
        <header className="text-center pt-3 pb-8">
          <div className="inline-block relative">
            <h1 className="text-2xl font-light tracking-[0.35em] text-stone-900 font-mono pl-1">
              FOCUS
            </h1>
          </div>

          <div className="mt-2.5 flex items-center justify-center space-x-2">
            <button
              onClick={onOpenFocusModal}
              className={`text-[10px] font-mono tracking-widest px-3 py-1 rounded-full cursor-pointer transition-all duration-200 border flex items-center space-x-1.5 ${
                focusMode
                  ? 'bg-stone-900 text-stone-100 border-stone-900 hover:bg-stone-800 shadow-xs'
                  : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${focusMode ? 'bg-emerald-400' : 'bg-stone-400'}`} />
              <span>{focusMode ? 'FOCUS MODE ACTIVE' : 'STANDARD MODE'}</span>
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
            {channels.length === 0 ? (
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
              channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white hover:shadow-2xs transition-all duration-150 group border border-transparent hover:border-stone-200/80 cursor-pointer"
                  onClick={() => onSelectChannel(channel)}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span className="text-sm font-normal text-stone-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-150">
                      {channel.title}
                    </span>
                    {channel.isPrivate && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 border border-stone-200">
                        {channel.isGroup ? 'Group' : 'Private'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Live simulation ping for demonstration */}
                    <button
                      onClick={() => onSimulateIncoming(channel.id)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-stone-400 hover:text-stone-800 transition font-mono px-1.5 py-0.5 rounded hover:bg-stone-100 cursor-pointer"
                      title="Simulate new channel post"
                    >
                      ping
                    </button>

                    {channel.hasNewPost && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs"
                        title="New post available"
                      />
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
            {contacts.length === 0 ? (
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
              contacts.map((contact) => {
                const hasNew = contact.status === 'new_message';
                return (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white hover:shadow-2xs transition-all duration-150 group border border-transparent hover:border-stone-200/80 cursor-pointer"
                    onClick={() => onSelectContact(contact)}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <span className="text-sm font-normal text-stone-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-150">
                        {contact.firstName} {contact.lastName || ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Live demonstration trigger */}
                      <button
                        onClick={() => onSimulateIncoming(contact.id)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-stone-400 hover:text-stone-800 transition font-mono px-1.5 py-0.5 rounded hover:bg-stone-100 cursor-pointer"
                        title={`Simulate message from ${contact.firstName}`}
                      >
                        ping
                      </button>

                      {/* Status indicator: 🔵 New message vs ⚪ No new message */}
                      <div
                        onClick={() => onSelectContact(contact)}
                        className="cursor-pointer p-0.5 flex items-center justify-center"
                        title={hasNew ? '🔵 New message' : '⚪ No new message'}
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
