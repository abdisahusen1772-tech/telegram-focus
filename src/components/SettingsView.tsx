'use client';

import React, { useState } from 'react';
import {
  Shield,
  Bell,
  Trash2,
  LogOut,
  Radio,
  Users,
  EyeOff,
  Sparkles,
  Smartphone,
  Palette,
  Lock,
  Check,
} from 'lucide-react';
import { UserSession, ApprovedContact, ApprovedChannel, AppSettings } from '@/lib/types';
import { notifyContactMessage } from '@/lib/notifications';
import { AppTheme, THEME_OPTIONS } from './ThemeSelectorModal';

interface SettingsViewProps {
  session: UserSession | null;
  settings: AppSettings;
  contacts: ApprovedContact[];
  channels: ApprovedChannel[];
  isApiConfigured: boolean;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onRemoveContact: (id: string) => Promise<void>;
  onRemoveChannel: (id: string) => Promise<void>;
  onDisconnectAccount: () => Promise<void>;
  onClearCache: () => Promise<void>;
  onOpenConnectModal: () => void;
}

export function SettingsView({
  session,
  settings,
  contacts,
  channels,
  isApiConfigured,
  currentTheme,
  onSelectTheme,
  onUpdateSettings,
  onRemoveContact,
  onRemoveChannel,
  onDisconnectAccount,
  onClearCache,
  onOpenConnectModal,
}: SettingsViewProps) {
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  const handleClearCache = async () => {
    setClearing(true);
    await onClearCache();
    setClearing(false);
    setClearSuccess(true);
    setTimeout(() => setClearSuccess(false), 2500);
  };

  const handleTestNotification = () => {
    const contactName = contacts[0]?.firstName || 'Ahmed';
    notifyContactMessage(contactName, settings.soundEnabled);
    setTestNotificationSent(true);
    setTimeout(() => setTestNotificationSent(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 max-w-md mx-auto w-full space-y-6 text-stone-900 pb-20 select-none">
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 font-mono">
          Settings
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Intentional parameters and anti-distraction rules
        </p>
      </div>

      {/* 1. Telegram Account Connection */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
          <Smartphone className="w-3.5 h-3.5 text-stone-500" />
          <span>Telegram Account</span>
        </div>

        {session && session.isConnected ? (
          <div className="space-y-3 text-xs">
            <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-stone-400 font-mono text-[11px]">User</span>
                <span className="font-medium text-stone-900">
                  {session.firstName} {session.lastName || ''}
                </span>
              </div>
              {session.username && (
                <div className="flex justify-between items-center">
                  <span className="text-stone-400 font-mono text-[11px]">Username</span>
                  <span className="font-mono text-stone-700">@{session.username}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-stone-400 font-mono text-[11px]">Phone</span>
                <span className="font-mono text-stone-700">{session.phone}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-stone-200/60">
                <span className="text-stone-400 font-mono text-[11px]">Connection</span>
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-800 font-medium">
                  {session.isDemoMode ? 'Distraction-Free Sandbox' : 'Official MTProto Active'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {session.isDemoMode && (
                <button
                  onClick={onOpenConnectModal}
                  className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium rounded-lg transition cursor-pointer shadow-xs"
                >
                  Link Real Telegram Account
                </button>
              )}
              <button
                onClick={onDisconnectAccount}
                className="py-2.5 px-3 bg-stone-50 hover:bg-red-50 text-stone-600 hover:text-red-700 border border-stone-200 hover:border-red-200 text-xs font-medium rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <p className="text-stone-500 leading-relaxed font-sans">
              No Telegram account connected. Connect to access your approved contacts and channels.
            </p>
            <button
              onClick={onOpenConnectModal}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium rounded-lg transition cursor-pointer shadow-xs"
            >
              Connect Telegram Account
            </button>
          </div>
        )}
      </section>

      {/* 2. Interface Themes (Choose from multiple colors) */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
            <Palette className="w-3.5 h-3.5 text-stone-500" />
            <span>Interface Theme</span>
          </div>
          <span className="text-[10px] font-mono text-stone-400 uppercase">
            {THEME_OPTIONS.find((t) => t.id === currentTheme)?.name}
          </span>
        </div>

        <p className="text-[11px] text-stone-500 leading-relaxed font-sans">
          Select a distraction-free color palette for day or night reading:
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {THEME_OPTIONS.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTheme(t.id)}
                className={`p-2.5 rounded-lg border text-left transition-all duration-150 relative cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-stone-900 ring-2 ring-stone-900/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
                style={{ backgroundColor: t.bgHex }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[11px] font-semibold tracking-tight"
                    style={{ color: t.textHex }}
                  >
                    {t.name}
                  </span>
                  {isSelected && (
                    <span
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: t.accentHex }}
                    >
                      <Check className="w-2 h-2 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 mt-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: t.cardHex }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: t.accentHex }}
                  />
                  <span
                    className="text-[9px] font-mono ml-auto opacity-70"
                    style={{ color: t.textHex }}
                  >
                    {t.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Focus & Anti-Distraction */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
          <Shield className="w-3.5 h-3.5 text-stone-500" />
          <span>Focus Mode</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-medium text-stone-900">Focus Mode Active</p>
            <p className="text-[11px] text-stone-400">
              Enforces zero-preview alerts & blocks discovery
            </p>
          </div>
          <button
            onClick={() => onUpdateSettings({ focusMode: !settings.focusMode })}
            className={`px-3 py-1 text-xs font-mono rounded-full cursor-pointer transition-all ${
              settings.focusMode
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {settings.focusMode ? 'ACTIVE' : 'OFF'}
          </button>
        </div>
      </section>

      {/* 4. Notifications (Message Preview ALWAYS OFF) */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
          <Bell className="w-3.5 h-3.5 text-stone-500" />
          <span>Notifications</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-medium text-stone-900">Notifications</p>
            <p className="text-[11px] text-stone-400">
              Only for explicitly approved contacts/channels
            </p>
          </div>
          <button
            onClick={() => onUpdateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
            className={`px-3 py-1 text-xs font-mono rounded-full cursor-pointer transition-all ${
              settings.notificationsEnabled
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {settings.notificationsEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Message Preview: ALWAYS OFF guarantee */}
        <div className="p-3 bg-stone-50 border border-stone-200/90 rounded-lg text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-stone-800 font-medium">
              <EyeOff className="w-3.5 h-3.5 text-stone-600" />
              <span>Message Preview</span>
            </div>
            <span className="font-mono text-[10px] bg-stone-900 text-white px-2 py-0.5 rounded-full font-medium">
              ALWAYS OFF
            </span>
          </div>
          <p className="text-[11px] text-stone-500 leading-relaxed font-sans">
            Guaranteed privacy: Notifications strictly display <span className="font-semibold text-stone-800">&ldquo;New message from Ahmed&rdquo;</span>. Actual content is never exposed on lock screens or popups.
          </p>
        </div>

        {/* Calm Sine Chime */}
        <div className="flex items-center justify-between py-1 border-t border-stone-100 pt-2.5">
          <div>
            <p className="text-xs font-medium text-stone-900">Calm Acoustic Chime</p>
            <p className="text-[11px] text-stone-400">Gentle two-tone sine chime (no harsh buzzer)</p>
          </div>
          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`px-3 py-1 text-xs font-mono rounded-full cursor-pointer transition-all ${
              settings.soundEnabled
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {settings.soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Test Notification Trigger */}
        <div className="pt-1">
          <button
            onClick={handleTestNotification}
            className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-stone-500" />
            <span>
              {testNotificationSent
                ? 'Dispatched: "New message from Ahmed"'
                : 'Test Distraction-Free Alert'}
            </span>
          </button>
        </div>
      </section>

      {/* 5. Manage Approved Content */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
          <Users className="w-3.5 h-3.5 text-stone-500" />
          <span>Approved Content</span>
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
            Approved Channels ({channels.length})
          </p>
          <div className="space-y-1.5">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200/80 rounded-lg text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Radio className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="font-medium text-stone-800 truncate">{ch.title}</span>
                  <span className="text-stone-400 font-mono text-[11px]">@{ch.username}</span>
                </div>
                <button
                  onClick={() => onRemoveChannel(ch.id)}
                  className="p-1 text-stone-400 hover:text-red-600 transition cursor-pointer"
                  title="Remove Channel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
            Approved Contacts ({contacts.length})
          </p>
          <div className="space-y-1.5">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200/80 rounded-lg text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="font-medium text-stone-800 truncate">
                    {c.firstName} {c.lastName || ''}
                  </span>
                  <span className="text-stone-400 font-mono text-[11px]">@{c.username}</span>
                </div>
                <button
                  onClick={() => onRemoveContact(c.id)}
                  className="p-1 text-stone-400 hover:text-red-600 transition cursor-pointer"
                  title="Remove Contact"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Privacy & Data Storage */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
          <Lock className="w-3.5 h-3.5 text-stone-500" />
          <span>Local Data & Privacy</span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed font-sans">
          Focus stores only explicitly approved contacts and channels. No analytics telemetry, no contact harvesting, and no ad profiling.
        </p>

        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="w-full py-2.5 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-stone-500" />
          <span>{clearing ? 'Clearing...' : 'Clear Cached Messages & Media'}</span>
        </button>
        {clearSuccess && (
          <p className="text-[11px] text-emerald-700 text-center font-mono">
            ✓ Cache cleared from local device
          </p>
        )}
      </section>

      {/* 7. Manifesto & About */}
      <section className="bg-stone-100 border border-stone-200/80 rounded-xl p-4 space-y-2 text-xs text-stone-600">
        <div className="flex justify-between items-center font-mono">
          <span className="font-semibold text-stone-800">Telegram Focus Client</span>
          <span className="text-[11px] text-stone-500">v1.0.0</span>
        </div>
        <p className="text-[11px] leading-relaxed text-stone-500 font-sans">
          &ldquo;The user decides what enters the app. The app should never decide what the user should see.&rdquo;
        </p>
      </section>
    </div>
  );
}
