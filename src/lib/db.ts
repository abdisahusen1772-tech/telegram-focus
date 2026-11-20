import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSchema, UserSession, ApprovedContact, ApprovedChannel, Message, AppSettings } from './types';
import bundledDbData from '../../data/focus_db.json';

const DEFAULT_API_ID = '36393150';
const DEFAULT_API_HASH = 'b08cd895004d8d1702eceab9e335dc06';

// Bundled DB file in git repository (read-only in Vercel/serverless lambdas)
const BUNDLED_DB_FILE = path.join(process.cwd(), 'data', 'focus_db.json');

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

// In serverless, only os.tmpdir() (/tmp) is writable. In local development, use project's data directory.
const DATA_DIR = isServerless
  ? path.join(os.tmpdir(), 'telegram-focus')
  : path.join(process.cwd(), 'data');

const DB_FILE = path.join(DATA_DIR, 'focus_db.json');

// In-memory database cache for instant access and serverless safety
let inMemoryDb: DatabaseSchema | null = null;

const DEFAULT_SETTINGS: AppSettings = {
  focusMode: true,
  messagePreviewAlwaysOff: true,
  notificationsEnabled: true,
  soundEnabled: true,
  highContrastEInk: false,
  channelNotifications: {},
  contactNotifications: {},
};

const DEFAULT_CHANNELS: ApprovedChannel[] = [];

const DEFAULT_CONTACTS: ApprovedContact[] = [];

const DEFAULT_MESSAGES: Message[] = [];

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('ensureDataDir notice:', err);
  }
}

export function getDb(): DatabaseSchema {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  ensureDataDir();

  // If the writable DB file doesn't exist yet, seed from bundled file or default schema
  if (!fs.existsSync(DB_FILE)) {
    let initialDb: DatabaseSchema | null = null;

    // First attempt to load bundled repo DB file
    if (fs.existsSync(BUNDLED_DB_FILE)) {
      try {
        const rawBundled = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
        initialDb = JSON.parse(rawBundled) as DatabaseSchema;
      } catch (err) {
        console.warn('Error reading bundled database file:', err);
      }
    }

    if (!initialDb) {
      try {
        initialDb = JSON.parse(JSON.stringify(bundledDbData)) as DatabaseSchema;
      } catch {
        initialDb = {
          session: null,
          contacts: DEFAULT_CONTACTS,
          channels: DEFAULT_CHANNELS,
          messages: DEFAULT_MESSAGES,
          settings: DEFAULT_SETTINGS,
          apiCredentials: {
            apiId: DEFAULT_API_ID,
            apiHash: DEFAULT_API_HASH,
          },
        };
      }
    }

    inMemoryDb = initialDb;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    } catch (writeErr) {
      console.warn('Could not persist initial DB file to disk (relying on memory):', writeErr);
    }
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    inMemoryDb = JSON.parse(raw) as DatabaseSchema;
    return inMemoryDb;
  } catch {
    // If corrupt, fallback to bundled file or defaults
    let fallbackDb: DatabaseSchema | null = null;
    if (fs.existsSync(BUNDLED_DB_FILE)) {
      try {
        const rawBundled = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
        fallbackDb = JSON.parse(rawBundled) as DatabaseSchema;
      } catch {
        // ignore
      }
    }

    if (!fallbackDb) {
      fallbackDb = {
        session: null,
        contacts: DEFAULT_CONTACTS,
        channels: DEFAULT_CHANNELS,
        messages: DEFAULT_MESSAGES,
        settings: DEFAULT_SETTINGS,
      };
    }

    inMemoryDb = fallbackDb;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(fallbackDb, null, 2), 'utf-8');
    } catch {
      // ignore
    }
    return fallbackDb;
  }
}

export function saveDb(data: DatabaseSchema): void {
  inMemoryDb = data;
  ensureDataDir();
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err: unknown) {
    // If disk write fails (e.g. read-only filesystem), do NOT crash the request
    console.warn('saveDb disk write warning (in-memory state preserved):', err instanceof Error ? err.message : String(err));
  }
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

export function removeApprovedContact(idOrUsername: string): boolean {
  const db = getDb();
  const initialLen = db.contacts.length;
  const clean = idOrUsername.toLowerCase().trim().replace(/^@/, '').replace(/^contact-/, '');

  db.contacts = db.contacts.filter(c => {
    const cCleanId = c.id.toLowerCase().replace(/^contact-/, '');
    const cCleanUser = (c.username || '').toLowerCase().replace(/^@/, '');
    const isMatch =
      c.id.toLowerCase() === idOrUsername.toLowerCase() ||
      cCleanId === clean ||
      Boolean(cCleanUser && cCleanUser === clean);
    return !isMatch;
  });

  db.messages = db.messages.filter(m => {
    const mCleanId = m.peerId.toLowerCase().replace(/^contact-/, '');
    return m.peerId.toLowerCase() !== idOrUsername.toLowerCase() && mCleanId !== clean;
  });

  delete db.settings.contactNotifications[idOrUsername];
  delete db.settings.contactNotifications[`contact-${clean}`];
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

export function togglePinContact(id: string): boolean {
  const db = getDb();
  const contact = db.contacts.find(c => c.id === id || c.username === id);
  if (contact) {
    contact.isPinned = !contact.isPinned;
    saveDb(db);
    return Boolean(contact.isPinned);
  }
  return false;
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

export function removeApprovedChannel(idOrUsername: string): boolean {
  const db = getDb();
  const initialLen = db.channels.length;
  const clean = idOrUsername.toLowerCase().trim().replace(/^@/, '').replace(/^channel-/, '').replace(/^-100/, '').replace(/^-/, '');

  db.channels = db.channels.filter(c => {
    const cCleanId = c.id.toLowerCase().replace(/^channel-/, '').replace(/^-100/, '').replace(/^-/, '');
    const cCleanUser = (c.username || '').toLowerCase().replace(/^@/, '');
    const isMatch =
      c.id.toLowerCase() === idOrUsername.toLowerCase() ||
      cCleanId === clean ||
      Boolean(cCleanUser && cCleanUser === clean);
    return !isMatch;
  });

  db.messages = db.messages.filter(m => {
    const mCleanId = m.peerId.toLowerCase().replace(/^channel-/, '').replace(/^-100/, '').replace(/^-/, '');
    return m.peerId.toLowerCase() !== idOrUsername.toLowerCase() && mCleanId !== clean;
  });

  delete db.settings.channelNotifications[idOrUsername];
  delete db.settings.channelNotifications[`channel-${clean}`];
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

export function togglePinChannel(id: string): boolean {
  const db = getDb();
  const channel = db.channels.find(c => c.id === id || c.username === id);
  if (channel) {
    channel.isPinned = !channel.isPinned;
    saveDb(db);
    return Boolean(channel.isPinned);
  }
  return false;
}

// Messages Helpers
export function cleanExpiredMessages(): void {
  const db = getDb();
  const now = Date.now();
  const initialLen = db.messages.length;
  db.messages = db.messages.filter(m => {
    if (m.expiresAt) {
      return new Date(m.expiresAt).getTime() > now;
    }
    return true;
  });
  if (db.messages.length !== initialLen) {
    saveDb(db);
  }
}

export function getPeerMessages(peerId: string): Message[] {
  cleanExpiredMessages();
  const db = getDb();
  const now = Date.now();
  const cleanId = peerId.toLowerCase().replace(/^@/, '').replace(/^contact-/, '').replace(/^channel-/, '');
  const matchedContact = db.contacts.find(c =>
    c.id.toLowerCase() === peerId.toLowerCase() ||
    c.id.toLowerCase() === `contact-${cleanId}` ||
    c.username.toLowerCase() === cleanId
  );
  const matchedChannel = db.channels.find(ch =>
    ch.id.toLowerCase() === peerId.toLowerCase() ||
    ch.id.toLowerCase() === `channel-${cleanId}` ||
    ch.username.toLowerCase() === cleanId
  );
  const targetId = matchedContact?.id || matchedChannel?.id || peerId;

  return db.messages
    .filter(m => {
      // Exclude messages scheduled for future
      if (m.scheduledFor && new Date(m.scheduledFor).getTime() > now) {
        return false;
      }

      const mClean = m.peerId.toLowerCase().replace(/^@/, '').replace(/^contact-/, '').replace(/^channel-/, '');
      return (
        m.peerId === targetId ||
        m.peerId === peerId ||
        mClean === cleanId ||
        (matchedContact && (m.peerId === matchedContact.username || m.peerId === `@${matchedContact.username}` || mClean === matchedContact.username.toLowerCase())) ||
        (matchedChannel && (m.peerId === matchedChannel.username || m.peerId === `@${matchedChannel.username}` || mClean === matchedChannel.username.toLowerCase()))
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function toggleMessageReaction(messageId: string, emoji: string): Message | null {
  const db = getDb();
  const msg = db.messages.find(m => m.id === messageId);
  if (!msg) return null;

  if (!msg.reactions) {
    msg.reactions = {};
  }

  const currentEmoji = msg.userReaction;
  if (currentEmoji === emoji) {
    // Toggle off
    msg.reactions[emoji] = Math.max(0, (msg.reactions[emoji] || 1) - 1);
    if (msg.reactions[emoji] === 0) {
      delete msg.reactions[emoji];
    }
    delete msg.userReaction;
  } else {
    // If user previously reacted with another emoji, decrease that one
    if (currentEmoji && msg.reactions[currentEmoji]) {
      msg.reactions[currentEmoji] = Math.max(0, msg.reactions[currentEmoji] - 1);
      if (msg.reactions[currentEmoji] === 0) {
        delete msg.reactions[currentEmoji];
      }
    }
    // Add new reaction
    msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
    msg.userReaction = emoji;
  }

  saveDb(db);
  return msg;
}

export function togglePinMessage(messageId: string): Message | null {
  const db = getDb();
  const msg = db.messages.find(m => m.id === messageId);
  if (!msg) return null;

  msg.isPinned = !msg.isPinned;
  saveDb(db);
  return msg;
}

export function voteMessagePoll(messageId: string, optionIndex: number): Message | null {
  const db = getDb();
  const msg = db.messages.find(m => m.id === messageId);
  if (!msg || !msg.poll || msg.poll.isClosed) return null;

  const poll = msg.poll;
  if (optionIndex < 0 || optionIndex >= poll.options.length) return null;

  // If user already voted for this option, do nothing
  if (poll.userVotedIndex === optionIndex) {
    return msg;
  }

  // If user previously voted for another option, remove old vote
  if (poll.userVotedIndex !== undefined && poll.userVotedIndex >= 0 && poll.userVotedIndex < poll.options.length) {
    poll.options[poll.userVotedIndex].votes = Math.max(0, poll.options[poll.userVotedIndex].votes - 1);
  } else {
    poll.totalVotes = (poll.totalVotes || 0) + 1;
  }

  poll.options[optionIndex].votes = (poll.options[optionIndex].votes || 0) + 1;
  poll.userVotedIndex = optionIndex;

  saveDb(db);
  return msg;
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
  const cleanId = peerId.toLowerCase().replace(/^@/, '');
  const contact = db.contacts.find(c => c.id === peerId || c.username.toLowerCase() === cleanId || c.id.toLowerCase() === `contact-${cleanId}`);
  if (contact) {
    contact.status = 'no_new_message';
    contact.unreadCount = 0;
  }
  const channel = db.channels.find(c => c.id === peerId || c.username.toLowerCase() === cleanId || c.id.toLowerCase() === `channel-${cleanId}`);
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
export function getApiCredentials(): { apiId: string; apiHash: string } {
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
  return {
    apiId: DEFAULT_API_ID,
    apiHash: DEFAULT_API_HASH,
  };
}

export function setApiCredentials(apiId: string, apiHash: string): void {
  const db = getDb();
  const cleanId = String(apiId).trim().replace(/['"]/g, '');
  const cleanHash = String(apiHash).trim().replace(/['"]/g, '');
  db.apiCredentials = {
    apiId: cleanId,
    apiHash: cleanHash,
  };
  process.env.TELEGRAM_API_ID = cleanId;
  process.env.TELEGRAM_API_HASH = cleanHash;
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
