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
  playCalmChime,
} from '@/lib/notifications';
import { Sun, Moon, BookOpen, Shield, Bell } from 'lucide-react';

type TabView = 'home' | 'channels' | 'contacts' | 'settings';
type ThemeMode = 'paper' | 'eink' | 'midnight';

export default function TelegramFocusApp() {
  const [activeTab, setActiveTab] = useState<TabView>('home');
  const [theme, setTheme] = useState<ThemeMode>('paper');
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

  // Handle Theme Classes on document body
  useEffect(() => {
    document.body.classList.remove('theme-paper', 'theme-eink', 'theme-midnight');
    if (settings.highContrastEInk || theme === 'eink') {
      document.body.classList.add('theme-eink');
    } else if (theme === 'midnight') {
      document.body.classList.add('theme-midnight');
    } else {
      document.body.classList.add('theme-paper');
    }
  }, [theme, settings.highContrastEInk]);

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
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
    }
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

          // Auto-hide toast after 4s
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

  return (
    <main className="min-h-screen bg-stone-200/60 flex flex-col justify-center items-center p-0 sm:p-6 transition-colors duration-300">
      {/* Top Desktop Aesthetic Bar */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-md px-3 py-2 mb-2 text-stone-500 font-mono text-[11px]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="tracking-wider">
            {session?.isConnected
              ? session.isDemoMode
                ? 'DISTRACTION-FREE SANDBOX'
                : 'TELEGRAM MTPROTO CONNECTED'
              : 'OFFLINE MODE'}
          </span>
        </div>

        {/* Theme Mode Switcher */}
        <div className="flex items-center space-x-1 bg-stone-300/60 p-0.5 rounded-lg border border-stone-300/80">
          <button
            onClick={() => {
              setTheme('paper');
              handleUpdateSettings({ highContrastEInk: false });
            }}
            className={`p-1 rounded cursor-pointer transition ${
              theme === 'paper' && !settings.highContrastEInk
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Warm Paper Theme"
          >
            <Sun className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              setTheme('eink');
              handleUpdateSettings({ highContrastEInk: true });
            }}
            className={`p-1 rounded cursor-pointer transition ${
              settings.highContrastEInk || theme === 'eink'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="E-Ink Monochrome Theme"
          >
            <BookOpen className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              setTheme('midnight');
              handleUpdateSettings({ highContrastEInk: false });
            }}
            className={`p-1 rounded cursor-pointer transition ${
              theme === 'midnight' && !settings.highContrastEInk
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Midnight Restful Theme"
          >
            <Moon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Distraction-Free Digital Notebook Frame */}
      <div className="w-full max-w-md h-screen sm:h-[820px] bg-stone-50 border sm:border-stone-300/90 sm:rounded-2xl shadow-md sm:shadow-xl flex flex-col overflow-hidden relative transition-colors duration-200">
        {/* Offline Banner (Section 15) */}
        <OfflineBanner
          isOffline={isOffline}
          lastSynced={lastSyncedTime}
          onSync={loadData}
          isSyncing={isSyncing}
        />

        {/* Distraction-Free In-App Notification Toast */}
        {activeToast && (
          <div
            onClick={handleToastClick}
            className="absolute top-3 left-4 right-4 z-40 bg-stone-900 text-stone-50 px-4 py-3 rounded-xl shadow-lg border border-stone-800 flex items-center justify-between cursor-pointer animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
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
            />
          )}
        </div>

        {/* Bottom Navigation (Section 8: Channels | Contacts | Settings) */}
        {!activeContact && !activeChannel && (
          <nav className="h-14 bg-white/90 backdrop-blur-xs border-t border-stone-200/90 flex items-center justify-around px-2 shrink-0 select-none shadow-2xs">
            <button
              onClick={() => {
                setActiveTab('home');
                setActiveContact(null);
                setActiveChannel(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'home' || activeTab === 'channels'
                  ? 'text-stone-950 font-bold border-b-2 border-stone-900 -mb-px'
                  : 'text-stone-400 hover:text-stone-700'
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
                  ? 'text-stone-950 font-bold border-b-2 border-stone-900 -mb-px'
                  : 'text-stone-400 hover:text-stone-700'
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
                  ? 'text-stone-950 font-bold border-b-2 border-stone-900 -mb-px'
                  : 'text-stone-400 hover:text-stone-700'
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
    </main>
  );
}
