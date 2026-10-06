import { TelegramClient, Api, sessions } from 'telegram';
const { StringSession } = sessions;
import { getUserSession, setUserSession, getApiCredentials, setApiCredentials, saveRealTelegramMessages } from './db';
import { ApprovedContact, ApprovedChannel, Message } from './types';

// In-memory active client reference
let activeClient: TelegramClient | null = null;
let currentPhoneCodeHash: string | null = null;
let currentPhoneNumber: string | null = null;

export function getActiveApiCredentials(): { apiId: number; apiHash: string } | null {
  const creds = getApiCredentials();
  if (!creds || !creds.apiId || !creds.apiHash) return null;
  const numId = parseInt(creds.apiId, 10);
  if (isNaN(numId) || numId <= 0) return null;
  return { apiId: numId, apiHash: creds.apiHash.trim() };
}

export function isTelegramApiConfigured(): boolean {
  return Boolean(getActiveApiCredentials());
}

export async function getOrInitTelegramClient(customSessionString?: string): Promise<TelegramClient | null> {
  const creds = getActiveApiCredentials();
  if (!creds) {
    return null;
  }
  const { apiId, apiHash } = creds;

  const existingSession = getUserSession();
  const sessionString = customSessionString || existingSession?.sessionString || '';

  if (!sessionString) {
    return null;
  }

  if (activeClient && activeClient.connected) {
    return activeClient;
  }

  try {
    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 2,
      timeout: 5,
      useWSS: false,
    });

    const connectPromise = client.connect();
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('MTProto connection timeout')), 4500)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    activeClient = client;
    return client;
  } catch (err) {
    console.warn('Could not establish Telegram MTProto client connection:', err);
    return null;
  }
}

/**
 * Phase 1: Send Telegram authentication verification code to phone number via MTProto
 */
export async function sendTelegramVerificationCode(phoneNumber: string, apiIdParam?: string, apiHashParam?: string): Promise<{
  success: boolean;
  phoneCodeHash?: string;
  isRegistered?: boolean;
  error?: string;
  isMock?: boolean;
}> {
  const cleanPhone = phoneNumber.trim();

  if (apiIdParam && apiHashParam) {
    setApiCredentials(apiIdParam, apiHashParam);
  }

  const creds = getActiveApiCredentials();

  // If real Telegram API credentials are configured, execute authentic MTProto call
  if (creds) {
    try {
      const { apiId, apiHash } = creds;
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

  const creds = getActiveApiCredentials();
  if (creds) {
    try {
      const { apiId, apiHash } = creds;

      if (!activeClient || !activeClient.connected) {
        const stringSession = new StringSession('');
        activeClient = new TelegramClient(stringSession, apiId, apiHash, {
          connectionRetries: 3,
        });
        await activeClient.connect();
      }

      try {
        await activeClient.invoke(
          new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash,
            phoneCode,
          })
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
export async function sendTelegramMessage(
  peerUsername: string,
  text: string,
  media?: { type: 'image' | 'video' | 'voice' | 'document'; url: string; name?: string }
): Promise<boolean> {
  const client = await getOrInitTelegramClient();
  if (client && client.connected) {
    try {
      const cleanUsername = peerUsername.replace(/^@/, '').trim();
      const entity = await client.getEntity(cleanUsername);

      if (media && media.url && media.url.startsWith('data:')) {
        try {
          const matches = media.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches[2]) {
            const buffer = Buffer.from(matches[2], 'base64');
            await client.sendFile(entity, {
              file: buffer,
              caption: text || (media.name ? `📎 ${media.name}` : undefined),
              workers: 1,
            });
            return true;
          }
        } catch (mediaErr) {
          console.warn('Failed to send raw media file via Telegram, falling back to message text:', mediaErr);
        }
      }

      await client.sendMessage(entity, {
        message: text + (media?.name ? `\n[Attached: ${media.name}]` : ''),
      });
      return true;
    } catch (err) {
      console.error('Failed to send Telegram message:', err);
      return false;
    }
  }
  return true; // simulated in demo mode
}

/**
 * Fetch live messages from real Telegram account for an approved contact or channel
 */
export async function syncMessagesFromTelegram(peerId: string, peerUsername: string): Promise<Message[]> {
  const client = await getOrInitTelegramClient();
  if (!client || !client.connected) {
    return [];
  }

  try {
    const cleanUsername = peerUsername.replace(/^@/, '').trim();
    const entity = await client.getEntity(cleanUsername);
    const tgMessages = await client.getMessages(entity, { limit: 25 });
    const me = (await client.getMe()) as unknown as { id: { toString: () => string }; firstName?: string };
    const myId = me?.id ? me.id.toString() : 'me';

    const synced: Message[] = [];
    for (const msg of tgMessages) {
      const textContent = (msg as unknown as { message?: string }).message || '';
      if (!textContent && !(msg as unknown as { media?: unknown }).media) continue;

      const isOut = Boolean((msg as unknown as { out?: boolean }).out);
      const unixDate = (msg as unknown as { date: number }).date;
      const mDate = unixDate ? new Date(unixDate * 1000).toISOString() : new Date().toISOString();
      const msgId = (msg as unknown as { id: number }).id;

      const newMsg: Message = {
        id: `tg-${peerId}-${msgId}`,
        peerId,
        senderId: isOut ? myId : peerId,
        senderName: isOut ? 'You' : cleanUsername,
        isOutgoing: isOut,
        text: textContent || '📎 [Media Attachment]',
        date: mDate,
      };
      synced.push(newMsg);
    }

    if (synced.length > 0) {
      saveRealTelegramMessages(peerId, synced);
    }

    return synced;
  } catch (err) {
    console.warn('Real telegram message fetch notice:', err);
    return [];
  }
}

export interface TelegramJoinedDialog {
  id: string;
  title: string;
  username?: string;
  isGroup: boolean;
  isChannel: boolean;
  isPrivate: boolean;
  unreadCount: number;
}

/**
 * Retrieve user's joined Telegram dialogs (groups and channels) to allow selectively adding private channels/groups
 */
export async function getMyTelegramDialogs(): Promise<TelegramJoinedDialog[]> {
  const client = await getOrInitTelegramClient();
  if (client && client.connected) {
    try {
      const dialogs = await client.getDialogs({ limit: 60 });
      const results: TelegramJoinedDialog[] = [];

      for (const d of dialogs) {
        const isChannel = Boolean(d.isChannel);
        const isGroup = Boolean(d.isGroup);

        if (!isChannel && !isGroup) continue;

        const entity = d.entity as unknown as {
          id?: { toString: () => string };
          title?: string;
          username?: string;
          megagroup?: boolean;
          broadcast?: boolean;
        };

        const idStr = d.id ? d.id.toString() : (entity?.id ? entity.id.toString() : '');
        if (!idStr) continue;

        const title = d.title || entity?.title || 'Private Group';
        const username = entity?.username || undefined;
        const isPrivate = !username;

        results.push({
          id: idStr,
          title,
          username,
          isGroup: isGroup || Boolean(entity?.megagroup),
          isChannel: isChannel && !entity?.megagroup,
          isPrivate,
          unreadCount: d.unreadCount || 0,
        });
      }

      return results;
    } catch (err) {
      console.warn('Telegram getDialogs notice:', err);
    }
  }

  // Simulated private groups/channels for sandbox / offline mode
  return [
    {
      id: '-100987654321',
      title: '📚 SAT & CS Study Group',
      isGroup: true,
      isChannel: false,
      isPrivate: true,
      unreadCount: 1,
    },
    {
      id: '-100876543210',
      title: '🏠 Private Family Circle',
      isGroup: true,
      isChannel: false,
      isPrivate: true,
      unreadCount: 0,
    },
    {
      id: '-100765432109',
      title: '🔒 Research Dispatch (Private Channel)',
      isGroup: false,
      isChannel: true,
      isPrivate: true,
      unreadCount: 2,
    },
  ];
}
