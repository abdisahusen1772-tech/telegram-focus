import { NextRequest } from 'next/server';
import { UserSession } from './types';
import { getUserSession, setUserSession } from './db';

/**
 * Universally resolve and restore a Telegram session across serverless environments.
 * Checks:
 * 1. Request header 'x-telegram-session' (sent directly by client localStorage)
 * 2. HTTP-only cookie 'tg_focus_session'
 * 3. In-memory / disk session from getDb()
 */
export function resolveSession(req?: NextRequest): UserSession | null {
  // 1. Check existing in-memory/disk session
  let session = getUserSession();
  if (session && session.isConnected && session.sessionString && session.sessionString.length > 20) {
    return session;
  }

  if (req) {
    // 2. Check header from client (localStorage persistence)
    const headerSessionStr = req.headers.get('x-telegram-session');
    if (headerSessionStr && headerSessionStr.trim().length > 20) {
      const cleanSessionStr = headerSessionStr.trim();
      const userId = req.headers.get('x-telegram-user-id') || session?.userId || 'tg-user';
      const firstName = req.headers.get('x-telegram-first-name') || session?.firstName || 'Telegram User';

      const restored: UserSession = {
        userId,
        firstName: decodeURIComponent(firstName),
        lastName: session?.lastName || '',
        username: session?.username || '',
        phone: session?.phone || '',
        sessionString: cleanSessionStr,
        isConnected: true,
        isDemoMode: false,
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
        if (parsed && parsed.sessionString && parsed.sessionString.length > 20 && parsed.isConnected) {
          setUserSession(parsed);
          return parsed;
        }
      } catch (err) {
        console.warn('Could not parse tg_focus_session cookie:', err);
      }
    }
  }

  return session;
}
