import fs from 'fs';
import path from 'path';
import { DatabaseSchema, UserSession, ApprovedContact, ApprovedChannel, Message, AppSettings } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'focus_db.json');

const DEFAULT_SETTINGS: AppSettings = {
  focusMode: true,
  messagePreviewAlwaysOff: true,
  notificationsEnabled: true,
  soundEnabled: true,
  highContrastEInk: false,
  channelNotifications: {
    'channel-study': true,
    'channel-islamic': false,
    'channel-news': true,
  },
  contactNotifications: {
    'contact-ahmed': true,
    'contact-abdullah': true,
    'contact-fatima': true,
  },
};

const DEFAULT_CHANNELS: ApprovedChannel[] = [
  {
    id: 'channel-study',
    username: 'studychannel',
    title: '📚 Study Channel',
    about: 'Curated deep-work resources, computer science notes, and distraction-free study techniques.',
    notificationsEnabled: true,
    addedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    lastPostAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    hasNewPost: true,
  },
  {
    id: 'channel-islamic',
    username: 'islamicchannel',
    title: '🕌 Islamic Channel',
    about: 'Daily reflections, Quranic reminders, and tranquil spiritual wisdom.',
    notificationsEnabled: false,
    addedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    lastPostAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    hasNewPost: false,
  },
  {
    id: 'channel-news',
    username: 'newschannel',
    title: '📰 News Channel',
    about: 'Minimal factual dispatches. No sensational headlines, no engagement bait.',
    notificationsEnabled: true,
    addedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastPostAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    hasNewPost: true,
  },
];

const DEFAULT_CONTACTS: ApprovedContact[] = [
  {
    id: 'contact-ahmed',
    username: 'ahmed_dev',
    firstName: 'Ahmed',
    lastName: 'K.',
    status: 'new_message', // 🔵 New message
    unreadCount: 1,
    notificationsEnabled: true,
    addedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'contact-abdullah',
    username: 'abdullah_m',
    firstName: 'Abdullah',
    status: 'no_new_message', // ⚪ No new message
    unreadCount: 0,
    notificationsEnabled: true,
    addedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    lastMessageAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'contact-fatima',
    username: 'fatima_research',
    firstName: 'Fatima',
    status: 'new_message', // 🔵 New message
    unreadCount: 2,
    notificationsEnabled: true,
    addedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
  },
];

const DEFAULT_MESSAGES: Message[] = [
  // Ahmed's conversation
  {
    id: 'msg-1',
    peerId: 'contact-ahmed',
    senderId: 'user-self',
    senderName: 'You',
    isOutgoing: true,
    text: 'Assalamu alaikum Ahmed, did you review the project outline for tomorrow?',
    date: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'msg-2',
    peerId: 'contact-ahmed',
    senderId: 'contact-ahmed',
    senderName: 'Ahmed',
    isOutgoing: false,
    text: 'Wa alaikum assalam! Yes I looked at it, looks solid.',
    date: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'msg-3',
    peerId: 'contact-ahmed',
    senderId: 'contact-ahmed',
    senderName: 'Ahmed',
    isOutgoing: false,
    text: 'Can you send me the assignment?',
    date: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },

  // Abdullah's conversation
  {
    id: 'msg-4',
    peerId: 'contact-abdullah',
    senderId: 'contact-abdullah',
    senderName: 'Abdullah',
    isOutgoing: false,
    text: 'Let me know whenever you have 10 minutes to walk through the system architecture.',
    date: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'msg-5',
    peerId: 'contact-abdullah',
    senderId: 'user-self',
    senderName: 'You',
    isOutgoing: true,
    text: 'Sure, we can connect tomorrow afternoon after Asr prayer.',
    date: new Date(Date.now() - 3600000 * 18).toISOString(),
  },

  // Fatima's conversation
  {
    id: 'msg-6',
    peerId: 'contact-fatima',
    senderId: 'contact-fatima',
    senderName: 'Fatima',
    isOutgoing: false,
    text: 'Peace! The latest research report on distraction-free interfaces has been compiled.',
    date: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'msg-7',
    peerId: 'contact-fatima',
    senderId: 'contact-fatima',
    senderName: 'Fatima',
    isOutgoing: false,
    text: 'I uploaded the key findings summary. Let me know what you think when you have time.',
    date: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    media: {
      type: 'document',
      url: '#',
      name: 'Distraction_Free_UI_Research.pdf',
      size: '1.4 MB',
    },
  },

  // Study Channel posts
  {
    id: 'post-study-1',
    peerId: 'channel-study',
    senderId: 'channel-study',
    senderName: '📚 Study Channel',
    isOutgoing: false,
    text: 'Deep Work Tip: Attention is a finite mental muscle. Every time you switch contexts to check a notification preview, your prefrontal cortex suffers from cognitive residue. By eliminating previews and algorithmic feeds, you reclaim hours of focused thinking.',
    date: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'post-study-2',
    peerId: 'channel-study',
    senderId: 'channel-study',
    senderName: '📚 Study Channel',
    isOutgoing: false,
    text: 'Algorithms in modern messengers are engineered to maximize your screen time through variable reward schedules. A tool should be an instrument that waits for your deliberate intent, like a fountain pen.',
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
  },

  // Islamic Channel posts
  {
    id: 'post-islamic-1',
    peerId: 'channel-islamic',
    senderId: 'channel-islamic',
    senderName: '🕌 Islamic Channel',
    isOutgoing: false,
    text: '"Take benefit of five before five: your youth before your old age, your health before your sickness, your wealth before your poverty, your free time before your preoccupation, and your life before your death." — Prophetic Wisdom',
    date: new Date(Date.now() - 3600000 * 6).toISOString(),
  },

  // News Channel posts
  {
    id: 'post-news-1',
    peerId: 'channel-news',
    senderId: 'channel-news',
    senderName: '📰 News Channel',
    isOutgoing: false,
    text: 'Global Tech Report: Open standards in communication protocols gain traction as users increasingly demand sovereign data privacy and freedom from ad-driven algorithms.',
    date: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DatabaseSchema = {
      session: {
        userId: 'demo-user-12345',
        firstName: 'Distraction-Free',
        lastName: 'User',
        username: 'focus_user',
        phone: '+1 (555) 019-2834',
        sessionString: 'demo_session_active',
        isConnected: true,
        isDemoMode: true,
        connectedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      },
      contacts: DEFAULT_CONTACTS,
      channels: DEFAULT_CHANNELS,
      messages: DEFAULT_MESSAGES,
      settings: DEFAULT_SETTINGS,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    // If corrupt, recreate defaults
    const initialDb: DatabaseSchema = {
      session: null,
      contacts: DEFAULT_CONTACTS,
      channels: DEFAULT_CHANNELS,
      messages: DEFAULT_MESSAGES,
      settings: DEFAULT_SETTINGS,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }
}

export function saveDb(data: DatabaseSchema): void {
  ensureDataDir();
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

// Session Helpers
export function getUserSession(): UserSession | null {
  const db = getDb();
  return db.session;
}

export function setUserSession(session: UserSession | null): void {
  const db = getDb();
  db.session = session;
  saveDb(db);
}

// Contacts Helpers
export function getApprovedContacts(): ApprovedContact[] {
  const db = getDb();
  return db.contacts;
}

export function addApprovedContact(contact: ApprovedContact): ApprovedContact {
  const db = getDb();
  const existing = db.contacts.find(c => c.username.toLowerCase() === contact.username.toLowerCase() || c.id === contact.id);
  if (existing) {
    return existing;
  }
  db.contacts.push(contact);
  if (!db.settings.contactNotifications[contact.id]) {
    db.settings.contactNotifications[contact.id] = true;
  }
  saveDb(db);
  return contact;
}

export function removeApprovedContact(id: string): boolean {
  const db = getDb();
  const initialLen = db.contacts.length;
  db.contacts = db.contacts.filter(c => c.id !== id && c.username !== id);
  db.messages = db.messages.filter(m => m.peerId !== id);
  delete db.settings.contactNotifications[id];
  saveDb(db);
  return db.contacts.length < initialLen;
}

export function updateContactStatus(id: string, status: 'new_message' | 'no_new_message', unreadCount = 0): void {
  const db = getDb();
  const contact = db.contacts.find(c => c.id === id || c.username === id);
  if (contact) {
    contact.status = status;
    contact.unreadCount = unreadCount;
    saveDb(db);
  }
}

// Channels Helpers
export function getApprovedChannels(): ApprovedChannel[] {
  const db = getDb();
  return db.channels;
}

export function addApprovedChannel(channel: ApprovedChannel): ApprovedChannel {
  const db = getDb();
  const existing = db.channels.find(c => c.username.toLowerCase() === channel.username.toLowerCase() || c.id === channel.id);
  if (existing) {
    return existing;
  }
  db.channels.push(channel);
  if (!db.settings.channelNotifications[channel.id]) {
    db.settings.channelNotifications[channel.id] = true;
  }
  saveDb(db);
  return channel;
}

export function removeApprovedChannel(id: string): boolean {
  const db = getDb();
  const initialLen = db.channels.length;
  db.channels = db.channels.filter(c => c.id !== id && c.username !== id);
  db.messages = db.messages.filter(m => m.peerId !== id);
  delete db.settings.channelNotifications[id];
  saveDb(db);
  return db.channels.length < initialLen;
}

export function updateChannelNotifications(id: string, enabled: boolean): void {
  const db = getDb();
  const channel = db.channels.find(c => c.id === id || c.username === id);
  if (channel) {
    channel.notificationsEnabled = enabled;
  }
  db.settings.channelNotifications[id] = enabled;
  saveDb(db);
}

// Messages Helpers
export function getPeerMessages(peerId: string): Message[] {
  const db = getDb();
  return db.messages
    .filter(m => m.peerId === peerId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function addMessageToPeer(message: Message): Message {
  const db = getDb();
  db.messages.push(message);

  // Update last message timestamp
  const contact = db.contacts.find(c => c.id === message.peerId);
  if (contact) {
    contact.lastMessageAt = message.date;
    if (!message.isOutgoing) {
      contact.status = 'new_message';
      contact.unreadCount = (contact.unreadCount || 0) + 1;
    }
  }

  const channel = db.channels.find(c => c.id === message.peerId);
  if (channel) {
    channel.lastPostAt = message.date;
    channel.hasNewPost = true;
  }

  saveDb(db);
  return message;
}

export function markPeerAsRead(peerId: string): void {
  const db = getDb();
  const contact = db.contacts.find(c => c.id === peerId);
  if (contact) {
    contact.status = 'no_new_message';
    contact.unreadCount = 0;
  }
  const channel = db.channels.find(c => c.id === peerId);
  if (channel) {
    channel.hasNewPost = false;
  }
  saveDb(db);
}

// Settings Helpers
export function getAppSettings(): AppSettings {
  const db = getDb();
  return db.settings;
}

export function updateAppSettings(partial: Partial<AppSettings>): AppSettings {
  const db = getDb();
  // Ensure messagePreviewAlwaysOff is NEVER overridden to false
  db.settings = {
    ...db.settings,
    ...partial,
    messagePreviewAlwaysOff: true,
  };
  saveDb(db);
  return db.settings;
}

// Privacy Helpers
export function clearCachedMessages(): void {
  const db = getDb();
  db.messages = [];
  // Reset unread indicators
  db.contacts.forEach(c => {
    c.status = 'no_new_message';
    c.unreadCount = 0;
  });
  db.channels.forEach(c => {
    c.hasNewPost = false;
  });
  saveDb(db);
}

export function resetToDemoDatabase(): DatabaseSchema {
  const initialDb: DatabaseSchema = {
    session: {
      userId: 'demo-user-12345',
      firstName: 'Distraction-Free',
      lastName: 'User',
      username: 'focus_user',
      phone: '+1 (555) 019-2834',
      sessionString: 'demo_session_active',
      isConnected: true,
      isDemoMode: true,
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    },
    contacts: DEFAULT_CONTACTS,
    channels: DEFAULT_CHANNELS,
    messages: DEFAULT_MESSAGES,
    settings: DEFAULT_SETTINGS,
  };
  saveDb(initialDb);
  return initialDb;
}

// Telegram API Credentials Helpers
export function getApiCredentials(): { apiId: string; apiHash: string } | null {
  const db = getDb();
  if (db.apiCredentials && db.apiCredentials.apiId && db.apiCredentials.apiHash) {
    return db.apiCredentials;
  }
  if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
    return {
      apiId: process.env.TELEGRAM_API_ID.trim(),
      apiHash: process.env.TELEGRAM_API_HASH.trim(),
    };
  }
  return null;
}

export function setApiCredentials(apiId: string, apiHash: string): void {
  const db = getDb();
  db.apiCredentials = {
    apiId: apiId.trim(),
    apiHash: apiHash.trim(),
  };
  saveDb(db);
}

export function saveRealTelegramMessages(peerId: string, realMessages: Message[]): void {
  const db = getDb();
  // Filter out existing messages for this peer with matching IDs
  const existingIds = new Set(db.messages.map(m => m.id));
  const newOnes = realMessages.filter(m => !existingIds.has(m.id));
  if (newOnes.length > 0) {
    db.messages.push(...newOnes);
    saveDb(db);
  }
}
