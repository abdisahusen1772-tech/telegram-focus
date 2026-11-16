import { NextRequest } from 'next/server';
import { UserSession, ApprovedChannel, ApprovedContact } from './types';
import { getUserSession, setUserSession, getDb, saveDb } from './db';

/**
 * Restore client's approved channels and contacts into serverless memory/disk
 * if the lambda is fresh or missing them.
 */
export function syncPeersFromHeaders(req?: NextRequest): void {
  if (!req) return;

  try {
    const channelsHeader = req.headers.get('x-telegram-channels');
    if (channelsHeader) {
      const parsedChannels = JSON.parse(decodeURIComponent(channelsHeader)) as ApprovedChannel[];
      if (Array.isArray(parsedChannels) && parsedChannels.length > 0) {
        const db = getDb();
        let changed = false;
        for (const ch of parsedChannels) {
          if (!ch || !ch.id) continue;
          const exists = db.channels.some(
            existing => existing.id === ch.id || (existing.username && ch.username && existing.username.toLowerCase() === ch.username.toLowerCase())
          );
          if (!exists) {
            db.channels.push(ch);
            if (!db.settings.channelNotifications[ch.id]) {
              db.settings.channelNotifications[ch.id] = ch.notificationsEnabled ?? true;
            }
            changed = true;
          }
        }
        if (changed) {
          saveDb(db);
        }
      }
    }
  } catch (err) {
    // ignore header parse errors
  }

  try {
    const contactsHeader = req.headers.get('x-telegram-contacts');
    if (contactsHeader) {
      const parsedContacts = JSON.parse(decodeURIComponent(contactsHeader)) as ApprovedContact[];
      if (Array.isArray(parsedContacts) && parsedContacts.length > 0) {
        const db = getDb();
        let changed = false;
        for (const c of parsedContacts) {
          if (!c || !c.id) continue;
          const exists = db.contacts.some(
            existing => existing.id === c.id || (existing.username && c.username && existing.username.toLowerCase() === c.username.toLowerCase())
          );
          if (!exists) {
            db.contacts.push(c);
            if (!db.settings.contactNotifications[c.id]) {
              db.settings.contactNotifications[c.id] = c.notificationsEnabled ?? true;
            }
            changed = true;
          }
        }
        if (changed) {
          saveDb(db);
        }
      }
    }
  } catch (err) {
    // ignore header parse errors
  }
}

/**
 * Universally resolve and restore a Telegram session across serverless environments.
 * Checks:
 * 1. Request header 'x-telegram-session' (sent directly by client localStorage)
 * 2. HTTP-only cookie 'tg_focus_session'
 * 3. In-memory / disk session from getDb()
 */
export function resolveSession(req?: NextRequest): UserSession | null {
  // Always sync peer lists if headers are provided
  if (req) {
    syncPeersFromHeaders(req);
  }

  // 1. Check existing in-memory/disk session
  let session = getUserSession();
  if (session && session.isConnected && session.sessionString && session.sessionString.length > 10) {
    return session;
  }

  if (req) {
    // 2. Check header from client (localStorage persistence)
    const headerSessionStr = req.headers.get('x-telegram-session');
    if (headerSessionStr && headerSessionStr.trim().length > 10) {
      const cleanSessionStr = headerSessionStr.trim();
      const userId = req.headers.get('x-telegram-user-id') || session?.userId || 'tg-user';
      const firstName = req.headers.get('x-telegram-first-name') || session?.firstName || 'Telegram User';
      const phone = req.headers.get('x-telegram-phone') || session?.phone || '';
      const username = req.headers.get('x-telegram-username') || session?.username || '';
      const isDemo = cleanSessionStr.startsWith('mock_') || cleanSessionStr.startsWith('demo_');

      const restored: UserSession = {
        userId,
        firstName: decodeURIComponent(firstName),
        lastName: session?.lastName || '',
        username,
        phone,
        sessionString: cleanSessionStr,
        isConnected: true,
        isDemoMode: isDemo,
        connectedAt: session?.connectedAt || new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      };

      setUserSession(restored);
      return restored;
    }

    // 3. Check cookie
    const cookieVal = req.cookies.get('tg_focus_session')?.value;
    if (cookieVal) {
      try {
        const parsed = JSON.parse(Buffer.from(cookieVal, 'base64').toString('utf-8')) as UserSession;
        if (parsed && parsed.sessionString && parsed.sessionString.length > 10 && parsed.isConnected) {
          setUserSession(parsed);
          return parsed;
        }
      } catch (err) {
        console.warn('Could not parse tg_focus_session cookie:', err);
      }
    }
  }

  if (session && session.isConnected && session.sessionString && session.sessionString.length > 10) {
    return session;
  }

  return null;
}
