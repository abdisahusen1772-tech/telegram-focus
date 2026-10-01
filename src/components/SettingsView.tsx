'use client';

import React, { useState, useEffect } from 'react';
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
  Key,
  ExternalLink,
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

  // API credentials input state
  const [apiIdInput, setApiIdInput] = useState('');
  const [apiHashInput, setApiHashInput] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsSaveMessage, setCredsSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/credentials')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.credentials) {
          setApiIdInput(d.credentials.apiId || '');
          setApiHashInput(d.credentials.apiHash || '');
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCredentials = async () => {
    if (!apiIdInput.trim() || !apiHashInput.trim()) return;
    setSavingCreds(true);
    setCredsSaveMessage(null);

    try {
      const res = await fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: apiIdInput.trim(),
          apiHash: apiHashInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCredsSaveMessage('✓ Credentials saved & activated successfully!');
        setTimeout(() => setCredsSaveMessage(null), 3500);
      } else {
        setCredsSaveMessage(`✕ Error: ${data.error || 'Failed to save'}`);
      }
    } catch {
      setCredsSaveMessage('✕ Error saving credentials');
    } finally {
      setSavingCreds(false);
    }
  };

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

      {/* 2. Telegram API Credentials (my.telegram.org) - ALWAYS VISIBLE */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-stone-700 uppercase tracking-wider font-mono">
            <Key className="w-3.5 h-3.5 text-stone-600" />
            <span>Telegram API Credentials</span>
          </div>
          <a
            href="https://my.telegram.org"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-blue-600 hover:underline flex items-center space-x-1 font-mono"
          >
            <span>my.telegram.org</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <p className="text-[11px] text-stone-500 leading-relaxed font-sans">
          To connect your real personal Telegram account via MTProto, enter your free credentials from <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">my.telegram.org</a> $\to$ <strong>API development tools</strong>:
        </p>

        <div className="space-y-2.5 pt-1 text-xs">
          <div>
            <label className="block text-[10px] font-mono uppercase text-stone-600 mb-1">
              Telegram API ID (App api_id)
            </label>
            <input
              type="text"
              value={apiIdInput}
              onChange={(e) => setApiIdInput(e.target.value)}
              placeholder="e.g. 28475912"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg font-mono focus:outline-none focus:border-stone-800 transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-stone-600 mb-1">
              Telegram API Hash (App api_hash)
            </label>
            <input
              type="text"
              value={apiHashInput}
              onChange={(e) => setApiHashInput(e.target.value)}
              placeholder="e.g. d3b07384d113edec49eaa6238ad5ff00"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg font-mono focus:outline-none focus:border-stone-800 transition"
            />
          </div>

          <div className="pt-1 flex items-center space-x-2">
            <button
              onClick={handleSaveCredentials}
              disabled={savingCreds || !apiIdInput.trim() || !apiHashInput.trim()}
              className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-stone-50 text-xs font-medium rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{savingCreds ? 'Saving...' : 'Save Credentials'}</span>
            </button>
            <button
              onClick={onOpenConnectModal}
              className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium rounded-lg transition cursor-pointer border border-stone-200"
            >
              Connect Phone →
            </button>
          </div>

          {credsSaveMessage && (
            <p className="text-[11px] text-emerald-700 text-center font-mono mt-1 font-medium">
              {credsSaveMessage}
            </p>
          )}
        </div>
      </section>

      {/* 3. Interface Themes (Choose from multiple colors) */}
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

      {/* 4. Focus & Anti-Distraction */}
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

      {/* 5. Notifications (Message Preview ALWAYS OFF) */}
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

      {/* 6. Manage Approved Content */}
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

      {/* 7. Privacy & Data Storage */}
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

      {/* 8. Manifesto & About */}
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
