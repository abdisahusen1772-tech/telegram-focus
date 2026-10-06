'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HomeScreen } from '@/components/HomeScreen';
import { ConversationView } from '@/components/ConversationView';
import { ChannelView } from '@/components/ChannelView';
import { SettingsView } from '@/components/SettingsView';
import { AddPeerModal } from '@/components/AddPeerModal';
import { ConnectTelegramModal } from '@/components/ConnectTelegramModal';
import { FocusModeBanner } from '@/components/FocusModeBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ThemeSelectorModal, AppTheme, THEME_OPTIONS } from '@/components/ThemeSelectorModal';
import {
  UserSession,
  ApprovedContact,
  ApprovedChannel,
  AppSettings,
} from '@/lib/types';
import {
  requestNotificationPermission,
  notifyContactMessage,
  notifyChannelPost,
} from '@/lib/notifications';
import { Palette } from 'lucide-react';

type TabView = 'home' | 'channels' | 'contacts' | 'settings';

export default function TelegramFocusApp() {
  const [activeTab, setActiveTab] = useState<TabView>('home');
  const [theme, setTheme] = useState<AppTheme>('paper');
  const [session, setSession] = useState<UserSession | null>(null);
  const [isApiConfigured, setIsApiConfigured] = useState<boolean>(false);
  const [contacts, setContacts] = useState<ApprovedContact[]>([]);
  const [channels, setChannels] = useState<ApprovedChannel[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    focusMode: true,
    messagePreviewAlwaysOff: true,
    notificationsEnabled: true,
    soundEnabled: true,
    highContrastEInk: false,
    theme: 'paper',
    channelNotifications: {},
    contactNotifications: {},
  });

  // Active Peer navigation
  const [activeContact, setActiveContact] = useState<ApprovedContact | null>(null);
  const [activeChannel, setActiveChannel] = useState<ApprovedChannel | null>(null);

  // Modals
  const [addModalType, setAddModalType] = useState<'contact' | 'channel' | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Distraction-free In-App Notification Toast
  const [activeToast, setActiveToast] = useState<{
    title: string;
    subtitle: string;
    peerId?: string;
    isContact?: boolean;
  } | null>(null);

  // Network & Sync State
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Initial data loading
  const loadData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Auth Status
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();
      if (authData.success) {
        setSession(authData.session);
        setIsApiConfigured(authData.isApiConfigured);
        if (authData.settings) {
          setSettings(authData.settings);
          if (authData.settings.theme) {
            setTheme(authData.settings.theme);
          }
        }
      }

      // Check localStorage for saved theme preference
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('focus_theme') as AppTheme;
        if (savedTheme && THEME_OPTIONS.some((t) => t.id === savedTheme)) {
          setTheme(savedTheme);
        }
      }

      // 2. Contacts
      const contactsRes = await fetch('/api/contacts');
      const contactsData = await contactsRes.json();
      if (contactsData.success) {
        setContacts(contactsData.contacts);
      }

      // 3. Channels
      const channelsRes = await fetch('/api/channels');
      const channelsData = await channelsRes.json();
      if (channelsData.success) {
        setChannels(channelsData.channels);
      }

      const now = new Date();
      setLastSyncedTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (e) {
      console.warn('Network sync issue:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    requestNotificationPermission();

    const handleOnline = () => {
      setIsOffline(false);
      loadData();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Periodic background check for new contact messages
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (!isOffline && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData();
      }
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [loadData, isOffline]);

  // Handle Theme Classes on document body
  useEffect(() => {
    document.body.classList.remove(
      'theme-paper',
      'theme-eink',
      'theme-obsidian',
      'theme-midnight',
      'theme-sage',
      'theme-nordic'
    );
    document.body.classList.add(`theme-${theme}`);
    if (typeof window !== 'undefined') {
      localStorage.setItem('focus_theme', theme);
    }
  }, [theme]);

  // Handle Settings updates
  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        if (data.settings.theme) {
          setTheme(data.settings.theme);
        }
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
    }
  };

  const handleSelectTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    handleUpdateSettings({ theme: newTheme });
  };

  const handleRemoveContact = async (id: string) => {
    try {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      if (activeContact?.id === id) setActiveContact(null);
    } catch (e) {
      console.error('Failed to remove contact:', e);
    }
  };

  const handleRemoveChannel = async (id: string) => {
    try {
      await fetch(`/api/channels?id=${id}`, { method: 'DELETE' });
      setChannels((prev) => prev.filter((ch) => ch.id !== id));
      if (activeChannel?.id === id) setActiveChannel(null);
    } catch (e) {
      console.error('Failed to remove channel:', e);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession(null);
    } catch (e) {
      console.error('Failed to disconnect:', e);
    }
  };

  const handleClearCache = async () => {
    try {
      await fetch('/api/privacy/clear-cache', { method: 'POST' });
      loadData();
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  };

  // Simulate an incoming message or post to demonstrate hidden previews
  const handleSimulateIncoming = async (peerId: string) => {
    try {
      const res = await fetch('/api/simulate-incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }),
      });
      const data = await res.json();

      if (data.success) {
        // Trigger Distraction-Free Notification (STRICT PRIVACY: NEVER LEAKS MESSAGE BODY)
        if (settings.notificationsEnabled) {
          if (data.type === 'contact') {
            notifyContactMessage(data.peerName, settings.soundEnabled);
            setActiveToast({
              title: `New message from ${data.peerName}`,
              subtitle: 'Preview hidden for focus • Tap to view',
              peerId,
              isContact: true,
            });
          } else {
            notifyChannelPost(data.peerName, settings.soundEnabled);
            setActiveToast({
              title: `New post in ${data.peerName}`,
              subtitle: 'Preview hidden for focus • Tap to view',
              peerId,
              isContact: false,
            });
          }

          setTimeout(() => {
            setActiveToast(null);
          }, 4500);
        }

        // Refresh contact/channel unread indicators
        loadData();
      }
    } catch (e) {
      console.error('Failed to simulate message:', e);
    }
  };

  const handleToastClick = () => {
    if (!activeToast) return;
    if (activeToast.isContact) {
      const c = contacts.find((contact) => contact.id === activeToast.peerId);
      if (c) {
        setActiveContact(c);
        setActiveChannel(null);
      }
    } else {
      const ch = channels.find((channel) => channel.id === activeToast.peerId);
      if (ch) {
        setActiveChannel(ch);
        setActiveContact(null);
      }
    }
    setActiveToast(null);
  };

  const currentThemeObj = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <main className="min-h-screen app-canvas flex flex-col justify-center items-center p-0 sm:p-6 transition-colors duration-300">
      {/* Top Desktop Aesthetic Bar */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-md px-3 py-2 mb-2 font-mono text-[11px] opacity-75">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="tracking-wider">
            {session?.isConnected
              ? session.isDemoMode
                ? 'DISTRACTION-FREE SANDBOX'
                : 'TELEGRAM MTPROTO ACTIVE'
              : 'OFFLINE MODE'}
          </span>
        </div>

        {/* Quick Theme Switcher Pill */}
        <button
          onClick={() => setIsThemeModalOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/40 hover:bg-white/70 dark:hover:bg-black/60 transition cursor-pointer text-xs"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>{currentThemeObj.name}</span>
        </button>
      </div>

      {/* Main Distraction-Free Digital Notebook Frame */}
      <div className="w-full max-w-md h-screen sm:h-[820px] app-frame border sm:rounded-2xl shadow-md sm:shadow-xl flex flex-col overflow-hidden relative transition-colors duration-200">
        {/* Offline Banner (Section 15) */}
        <OfflineBanner
          isOffline={isOffline}
          lastSynced={lastSyncedTime}
          onSync={loadData}
          isSyncing={isSyncing}
        />

        {/* Telegram Session Disconnected / Expired Alert Banner */}
        {!session?.isConnected && (
          <div className="bg-amber-900/90 text-amber-50 px-3.5 py-2 mx-3 mt-2 rounded-xl border border-amber-700/80 shadow-xs flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center space-x-2 overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="truncate">
                <p className="text-xs font-semibold tracking-tight text-white truncate">
                  Telegram Disconnected
                </p>
                <p className="text-[10px] text-amber-200/90 font-mono truncate">
                  Connect account to load your real groups & receive messages
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 border border-amber-600 transition cursor-pointer shrink-0 ml-2"
            >
              Connect →
            </button>
          </div>
        )}

        {/* Top Incoming Contact Alert Banner (Check on PC or open directly) */}
        {!activeContact && !activeChannel && (
          contacts.some((c) => c.status === 'new_message') ? (
            <div className="bg-stone-900 text-stone-50 px-3.5 py-2.5 mx-3 mt-2 rounded-xl border border-stone-800 shadow-md flex items-center justify-between z-30 shrink-0">
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <span className="w-2.5 h-2.5 rounded-full indicator-blue animate-pulse shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-semibold tracking-tight text-white truncate">
                    {(() => {
                      const unread = contacts.filter((c) => c.status === 'new_message');
                      if (unread.length === 1) {
                        return `New message from ${unread[0].firstName} ${unread[0].lastName || ''}`.trim();
                      }
                      return `New messages from ${unread.map((c) => c.firstName).join(', ')}`;
                    })()}
                  </p>
                  <p className="text-[10px] text-stone-400 font-mono truncate">
                    Received on Telegram · Check on your PC or tap to open
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const target = contacts.find((c) => c.status === 'new_message');
                  if (target) {
                    setActiveContact(target);
                    setActiveChannel(null);
                  }
                }}
                className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition cursor-pointer shrink-0 ml-2"
              >
                Open →
              </button>
            </div>
          ) : (
            <div className="bg-stone-100/90 dark:bg-stone-900/40 text-stone-600 dark:text-stone-300 px-3.5 py-2 mx-3 mt-2 rounded-xl border border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between z-30 shrink-0">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="w-2 h-2 rounded-full indicator-white shrink-0" />
                <p className="text-xs font-mono tracking-tight text-stone-600 dark:text-stone-300 truncate">
                  You have no message from contact
                </p>
              </div>
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500 shrink-0 ml-2">
                All caught up
              </span>
            </div>
          )
        )}

        {/* Distraction-Free In-App Notification Toast */}
        {activeToast && (
          <div
            onClick={handleToastClick}
            className="absolute top-3 left-4 right-4 z-40 bg-stone-900 text-stone-50 px-4 py-3 rounded-xl shadow-lg border border-stone-800 flex items-center justify-between cursor-pointer animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <span className="w-2.5 h-2.5 rounded-full indicator-blue shrink-0" />
              <div className="truncate">
                <p className="text-xs font-semibold tracking-tight truncate">
                  {activeToast.title}
                </p>
                <p className="text-[10px] text-stone-400 font-mono truncate">
                  {activeToast.subtitle}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-stone-400 shrink-0 ml-2">
              OPEN →
            </span>
          </div>
        )}

        {/* View Switcher */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeContact ? (
            <ConversationView
              contact={activeContact}
              onBack={() => {
                setActiveContact(null);
                loadData();
              }}
              onMessageSent={loadData}
            />
          ) : activeChannel ? (
            <ChannelView
              channel={activeChannel}
              onBack={() => {
                setActiveChannel(null);
                loadData();
              }}
              onNotificationToggled={(enabled) => {
                setChannels((prev) =>
                  prev.map((c) =>
                    c.id === activeChannel.id
                      ? { ...c, notificationsEnabled: enabled }
                      : c
                  )
                );
              }}
            />
          ) : activeTab === 'settings' ? (
            <SettingsView
              session={session}
              settings={settings}
              contacts={contacts}
              channels={channels}
              isApiConfigured={isApiConfigured}
              currentTheme={theme}
              onSelectTheme={handleSelectTheme}
              onUpdateSettings={handleUpdateSettings}
              onRemoveContact={handleRemoveContact}
              onRemoveChannel={handleRemoveChannel}
              onDisconnectAccount={handleDisconnect}
              onClearCache={handleClearCache}
              onOpenConnectModal={() => setIsConnectModalOpen(true)}
            />
          ) : (
            <HomeScreen
              channels={channels}
              contacts={contacts}
              onSelectChannel={(ch) => setActiveChannel(ch)}
              onSelectContact={(c) => setActiveContact(c)}
              onOpenAddModal={(t) => setAddModalType(t)}
              onSimulateIncoming={handleSimulateIncoming}
              focusMode={settings.focusMode}
              onOpenFocusModal={() => setIsFocusModalOpen(true)}
              onOpenThemeModal={() => setIsThemeModalOpen(true)}
              themeName={currentThemeObj.name}
            />
          )}
        </div>

        {/* Bottom Navigation (Section 8: Channels | Contacts | Settings) */}
        {!activeContact && !activeChannel && (
          <nav className="h-14 bg-white/90 backdrop-blur-xs border-t border-black/10 dark:border-white/10 flex items-center justify-around px-2 shrink-0 select-none shadow-2xs">
            <button
              onClick={() => {
                setActiveTab('home');
                setActiveContact(null);
                setActiveChannel(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'home' || activeTab === 'channels'
                  ? 'font-bold border-b-2 border-current -mb-px'
                  : 'opacity-40 hover:opacity-80'
              }`}
            >
              Channels
            </button>

            <button
              onClick={() => {
                setActiveTab('home');
                setActiveContact(null);
                setActiveChannel(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'contacts'
                  ? 'font-bold border-b-2 border-current -mb-px'
                  : 'opacity-40 hover:opacity-80'
              }`}
            >
              Contacts
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                setActiveContact(null);
                setActiveChannel(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'settings'
                  ? 'font-bold border-b-2 border-current -mb-px'
                  : 'opacity-40 hover:opacity-80'
              }`}
            >
              Settings
            </button>
          </nav>
        )}
      </div>

      {/* Add Contact or Channel Modal */}
      {addModalType && (
        <AddPeerModal
          isOpen={Boolean(addModalType)}
          type={addModalType}
          onClose={() => setAddModalType(null)}
          onSuccess={loadData}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
        />
      )}

      {/* Telegram MTProto Authentication Modal */}
      <ConnectTelegramModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={loadData}
        isApiConfigured={isApiConfigured}
      />

      {/* Focus Mode Overlay */}
      <FocusModeBanner
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        focusMode={settings.focusMode}
        onToggleFocus={(val) => handleUpdateSettings({ focusMode: val })}
      />

      {/* Theme Selection Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        currentTheme={theme}
        onSelectTheme={handleSelectTheme}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </main>
  );
}
