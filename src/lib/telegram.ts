import { TelegramClient, sessions } from 'telegram';
const { StringSession } = sessions;
import { getUserSession, setUserSession } from './db';
import { ApprovedContact, ApprovedChannel, Message } from './types';

// Telegram API credentials
const API_ID = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_HASH ? process.env.TELEGRAM_API_ID : '0', 10) : 0;
const API_HASH = process.env.TELEGRAM_API_HASH || '';

// In-memory active client reference
let activeClient: TelegramClient | null = null;
let currentPhoneCodeHash: string | null = null;
let currentPhoneNumber: string | null = null;

export function isTelegramApiConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH && process.env.TELEGRAM_API_ID.trim() !== '');
}

export async function getOrInitTelegramClient(customSessionString?: string): Promise<TelegramClient | null> {
  const apiId = API_ID || parseInt(process.env.TELEGRAM_API_ID || '0', 10);
  const apiHash = API_HASH || process.env.TELEGRAM_API_HASH || '';

  if (!apiId || !apiHash) {
    return null;
  }

  const existingSession = getUserSession();
  const sessionString = customSessionString || existingSession?.sessionString || '';

  if (activeClient && activeClient.connected) {
    return activeClient;
  }

  const stringSession = new StringSession(sessionString);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  await client.connect();
  activeClient = client;
  return client;
}

/**
 * Phase 1: Send Telegram authentication verification code to phone number via MTProto
 */
export async function sendTelegramVerificationCode(phoneNumber: string): Promise<{
  success: boolean;
  phoneCodeHash?: string;
  isRegistered?: boolean;
  error?: string;
  isMock?: boolean;
}> {
  const cleanPhone = phoneNumber.trim();

  // If real Telegram API credentials are configured, execute authentic MTProto call
  if (isTelegramApiConfigured()) {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID!, 10);
      const apiHash = process.env.TELEGRAM_API_HASH!;
      const stringSession = new StringSession('');
      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
      });

      await client.connect();
      activeClient = client;

      const result = await client.sendCode(
        {
          apiId,
          apiHash,
        },
        cleanPhone
      );

      currentPhoneCodeHash = result.phoneCodeHash;
      currentPhoneNumber = cleanPhone;

      return {
        success: true,
        phoneCodeHash: result.phoneCodeHash,
        isRegistered: result.isCodeViaApp !== undefined,
        isMock: false,
      };
    } catch (err: unknown) {
      console.error('Telegram MTProto sendCode error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send Telegram code';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // If credentials are not set, provide simulated authentication for immediate testing
  currentPhoneNumber = cleanPhone;
  currentPhoneCodeHash = 'mock_phone_code_hash_' + Date.now();
  return {
    success: true,
    phoneCodeHash: currentPhoneCodeHash,
    isRegistered: true,
    isMock: true,
  };
}

/**
 * Phase 1: Sign in with phone code (and optional 2FA password)
 */
export async function signInWithTelegramCode(params: {
  phoneNumber: string;
  phoneCode: string;
  phoneCodeHash: string;
  password?: string;
}): Promise<{
  success: boolean;
  needs2FA?: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    phone: string;
  };
  error?: string;
}> {
  const { phoneNumber, phoneCode, phoneCodeHash, password } = params;

  if (isTelegramApiConfigured() && activeClient) {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID!, 10);
      const apiHash = process.env.TELEGRAM_API_HASH!;

      try {
        await activeClient.signInUser(
          {
            apiId,
            apiHash,
          },
          {
            phoneNumber,
            phoneCode: async () => phoneCode,
            password: password ? async () => password : undefined,
            onError: (err) => {
              throw err;
            },
          }
        );
      } catch (signInErr: unknown) {
        const errMsg = signInErr instanceof Error ? signInErr.message : String(signInErr);
        if (errMsg.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
            return {
              success: false,
              needs2FA: true,
              error: 'Two-Factor Authentication is enabled on this Telegram account. Please enter your 2FA password.',
            };
          }
          // Authenticate with 2FA password
          await activeClient.signInWithPassword(
            {
              apiId,
              apiHash,
            },
            {
              password: async () => password,
              onError: (pErr) => {
                throw pErr;
              },
            }
          );
        } else {
          throw signInErr;
        }
      }

      const me = await activeClient.getMe();
      const sessionString = (activeClient.session.save() as unknown as string) || '';

      const meUser = me as unknown as {
        id: { toString: () => string };
        firstName?: string;
        lastName?: string;
        username?: string;
        phone?: string;
      };

      const userSession = {
        userId: meUser.id.toString(),
        firstName: meUser.firstName || 'Telegram User',
        lastName: meUser.lastName || '',
        username: meUser.username || '',
        phone: meUser.phone || phoneNumber,
        sessionString,
        isConnected: true,
        isDemoMode: false,
        connectedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      };

      setUserSession(userSession);

      return {
        success: true,
        user: {
          id: userSession.userId,
          firstName: userSession.firstName,
          lastName: userSession.lastName,
          username: userSession.username,
          phone: userSession.phone,
        },
      };
    } catch (err: unknown) {
      console.error('Telegram MTProto signIn error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Invalid code or authentication error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Sandbox / Demo login simulation
  const mockUserSession = {
    userId: 'tg_user_' + Math.floor(Math.random() * 1000000),
    firstName: 'Focus',
    lastName: 'User',
    username: phoneNumber.replace(/[^0-9]/g, '').slice(-6),
    phone: phoneNumber,
    sessionString: 'mock_session_token_' + Date.now(),
    isConnected: true,
    isDemoMode: true,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };

  setUserSession(mockUserSession);

  return {
    success: true,
    user: {
      id: mockUserSession.userId,
      firstName: mockUserSession.firstName,
      lastName: mockUserSession.lastName,
      username: mockUserSession.username,
      phone: mockUserSession.phone,
    },
  };
}

/**
 * Phase 2 & 3: Verify and resolve username (contact or channel) via Telegram
 */
export async function verifyTelegramUsername(rawUsername: string): Promise<{
  success: boolean;
  entityType?: 'contact' | 'channel' | 'group';
  contact?: ApprovedContact;
  channel?: ApprovedChannel;
  error?: string;
}> {
  const username = rawUsername.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '').trim();

  if (!username || username.length < 3) {
    return {
      success: false,
      error: 'Please enter a valid Telegram username (e.g. @username)',
    };
  }

  const client = await getOrInitTelegramClient();

  if (client && client.connected) {
    try {
      const entity = await client.getEntity(username) as unknown as {
        id: { toString: () => string };
        className: string;
        firstName?: string;
        lastName?: string;
        title?: string;
        username?: string;
        phone?: string;
        about?: string;
        broadcast?: boolean;
        megagroup?: boolean;
      };

      const entityId = entity.id.toString();
      const isChannel = entity.className === 'Channel' || entity.broadcast === true;

      if (isChannel) {
        const approvedChannel: ApprovedChannel = {
          id: `channel-${entityId}`,
          username: entity.username || username,
          title: entity.title || username,
          about: entity.about || 'Approved Telegram Channel',
          notificationsEnabled: true,
          addedAt: new Date().toISOString(),
          lastPostAt: new Date().toISOString(),
          hasNewPost: false,
        };
        return {
          success: true,
          entityType: 'channel',
          channel: approvedChannel,
        };
      } else {
        const approvedContact: ApprovedContact = {
          id: `contact-${entityId}`,
          username: entity.username || username,
          firstName: entity.firstName || username,
          lastName: entity.lastName || '',
          phone: entity.phone,
          status: 'no_new_message',
          unreadCount: 0,
          notificationsEnabled: true,
          addedAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
        };
        return {
          success: true,
          entityType: 'contact',
          contact: approvedContact,
        };
      }
    } catch (err: unknown) {
      console.warn('Telegram getEntity lookup failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Username not found on Telegram';
      return {
        success: false,
        error: `Could not verify @${username} on Telegram: ${errMsg}`,
      };
    }
  }

  // Demo / Offline verification generator for testing
  const isLikelyChannel = username.toLowerCase().includes('channel') ||
                          username.toLowerCase().includes('news') ||
                          username.toLowerCase().includes('study') ||
                          username.toLowerCase().includes('daily') ||
                          username.toLowerCase().includes('islamic');

  if (isLikelyChannel) {
    const formattedTitle = username
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    return {
      success: true,
      entityType: 'channel',
      channel: {
        id: `channel-${Date.now()}`,
        username,
        title: `📢 ${formattedTitle}`,
        about: `Distraction-free updates from @${username}`,
        notificationsEnabled: true,
        addedAt: new Date().toISOString(),
        lastPostAt: new Date().toISOString(),
        hasNewPost: false,
      },
    };
  } else {
    const formattedName = username
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    return {
      success: true,
      entityType: 'contact',
      contact: {
        id: `contact-${Date.now()}`,
        username,
        firstName: formattedName,
        status: 'no_new_message',
        unreadCount: 0,
        notificationsEnabled: true,
        addedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Send message to an approved contact
 */
export async function sendTelegramMessage(peerUsername: string, text: string): Promise<boolean> {
  const client = await getOrInitTelegramClient();
  if (client && client.connected) {
    try {
      const entity = await client.getEntity(peerUsername);
      await client.sendMessage(entity, { message: text });
      return true;
    } catch (err) {
      console.error('Failed to send Telegram message:', err);
      return false;
    }
  }
  return true; // simulated in demo mode
}
