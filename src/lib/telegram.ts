import { TelegramClient, Api, sessions } from 'telegram';
const { StringSession } = sessions;
import { getUserSession, setUserSession, getApiCredentials, setApiCredentials, saveRealTelegramMessages, getApprovedContacts, updateContactStatus, addApprovedContact, getPeerMessages } from './db';
import { ApprovedContact, ApprovedChannel, Message, UserSession } from './types';

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
    console.warn('Telegram API credentials not configured');
    return null;
  }
  const { apiId, apiHash } = creds;

  const existingSession = getUserSession();
  const sessionString = customSessionString || existingSession?.sessionString || '';

  if (!sessionString || sessionString.length < 15 || sessionString.startsWith('mock_') || sessionString.startsWith('demo_')) {
    return null;
  }

  // If activeClient exists and matches this session, reuse it
  if (activeClient && activeClient.connected) {
    try {
      const currentSaved = activeClient.session.save() as unknown as string;
      if (currentSaved === sessionString) {
        return activeClient;
      }
    } catch {
      // ignore
    }
  }

  // Clean up any stale client reference
  if (activeClient) {
    try {
      await activeClient.disconnect();
    } catch {}
    activeClient = null;
  }

  // Attempt connection with retry to handle serverless concurrency
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const stringSession = new StringSession(sessionString);
      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
        timeout: 15,
        useWSS: false,
      });

      const connectPromise = client.connect();
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('MTProto connection timeout (15s)')), 15000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      activeClient = client;
      return client;
    } catch (err: unknown) {
      const errStr = String(err);
      console.warn(`MTProto connect attempt ${attempt} notice:`, errStr);

      if (
        errStr.includes('AUTH_KEY_UNREGISTERED') ||
        errStr.includes('SESSION_REVOKED') ||
        errStr.includes('SESSION_EXPIRED')
      ) {
        console.warn('Telegram session key revoked by Telegram DC.');
        const current = getUserSession();
        if (current) {
          setUserSession({
            ...current,
            isConnected: false,
            sessionString: '',
          });
        }
        activeClient = null;
        return null;
      }

      if (errStr.includes('AUTH_KEY_DUPLICATED') && attempt < 2) {
        // Concurrent serverless connection collision. Wait 1.2s before retry.
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      if (attempt === 2) {
        return null;
      }
    }
  }

  return null;
}

/**
 * Phase 1: Send Telegram authentication verification code to phone number via MTProto
 */
export async function sendTelegramVerificationCode(phoneNumber: string, apiIdParam?: string, apiHashParam?: string): Promise<{
  success: boolean;
  phoneCodeHash?: string;
  intermediateSession?: string;
  isRegistered?: boolean;
  error?: string;
  isMock?: boolean;
}> {
  let cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
  // Auto-format Ethiopian domestic numbers (09... or 07...) to international format +251...
  if (/^0[79]\d{8}$/.test(cleanPhone)) {
    cleanPhone = '+251' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

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
        timeout: 10,
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
      const intermediateSession = (client.session.save() as unknown as string) || '';

      return {
        success: true,
        phoneCodeHash: result.phoneCodeHash,
        intermediateSession,
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
  intermediateSession?: string;
}): Promise<{
  success: boolean;
  needs2FA?: boolean;
  session?: UserSession;
  user?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    phone: string;
  };
  error?: string;
}> {
  const { phoneNumber, phoneCode, phoneCodeHash, password, intermediateSession } = params;
  let cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
  if (/^0[79]\d{8}$/.test(cleanPhone)) {
    cleanPhone = '+251' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

  const creds = getActiveApiCredentials();
  if (creds) {
    try {
      const { apiId, apiHash } = creds;

      if (!activeClient || !activeClient.connected) {
        const stringSession = new StringSession(intermediateSession || '');
        activeClient = new TelegramClient(stringSession, apiId, apiHash, {
          connectionRetries: 3,
          timeout: 12,
        });
        await activeClient.connect();
      }

      try {
        await activeClient.invoke(
          new Api.auth.SignIn({
            phoneNumber: cleanPhone,
            phoneCodeHash,
            phoneCode: phoneCode.trim(),
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
        session: userSession,
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
    session: mockUserSession,
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
export async function verifyTelegramUsername(rawUsername: string, customSessionString?: string): Promise<{
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

  const client = await getOrInitTelegramClient(customSessionString);

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
  media?: { type: 'image' | 'video' | 'voice' | 'document'; url: string; name?: string },
  customSessionString?: string
): Promise<boolean> {
  const client = await getOrInitTelegramClient(customSessionString);
  if (client && client.connected) {
    try {
      const cleanUsername = peerUsername ? peerUsername.replace(/^@/, '').trim().toLowerCase() : '';
      const cleanRawId = peerUsername
        .replace(/^contact-/, '')
        .replace(/^channel-/, '')
        .replace(/^user_/, '')
        .replace(/^private_/, '')
        .replace(/^-100/, '')
        .replace(/^-/, '')
        .toLowerCase();
      let entity: unknown = null;

      // 1. If username is available and not a placeholder, try direct entity lookup first (fastest)
      if (cleanUsername && !cleanUsername.startsWith('user_') && !cleanUsername.startsWith('private_')) {
        try {
          entity = await client.getEntity(cleanUsername);
        } catch {
          // Fall through to dialog search
        }
      }

      // 2. Search dialogs (contains pre-resolved inputEntity with accessHash)
      if (!entity) {
        try {
          const dialogs = await client.getDialogs({ limit: 120 });
          const matched = dialogs.find((d) => {
            const dEntity = d.entity as unknown as { id?: { toString: () => string }; username?: string };
            const dIdStr = d.id ? d.id.toString() : (dEntity?.id ? dEntity.id.toString() : '');
            const cleanDId = dIdStr.replace(/^-100/, '').replace(/^-/, '').toLowerCase();
            const dUser = dEntity?.username?.toLowerCase();
            return (
              cleanDId === cleanRawId ||
              (cleanUsername && !cleanUsername.startsWith('user_') && !cleanUsername.startsWith('private_') && dUser === cleanUsername)
            );
          });
          if (matched) {
            entity = matched.inputEntity || matched.entity;
          }
        } catch (dErr) {
          console.warn('Dialog search notice in sendTelegramMessage:', dErr);
        }
      }

      // 3. Fallback: try getEntity by numeric ID (-100 and clean)
      if (!entity && cleanRawId) {
        try {
          entity = await client.getEntity(`-100${cleanRawId}`);
        } catch {
          try {
            entity = await client.getEntity(cleanRawId);
          } catch {
            // ignore
          }
        }
      }

      if (!entity) {
        console.warn('Could not resolve entity to send Telegram message:', peerUsername);
        return false;
      }

      if (media && media.url && media.url.startsWith('data:')) {
        try {
          const matches = media.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches[2]) {
            const buffer = Buffer.from(matches[2], 'base64');
            await client.sendFile(entity as any, {
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

      await client.sendMessage(entity as any, {
        message: text + (media?.name ? `\n[Attached: ${media.name}]` : ''),
      });
      return true;
    } catch (err) {
      console.error('Failed to send Telegram message:', err);
      throw err;
    }
  }
  return true; // simulated in demo mode
}

/**
 * Fetch live messages from real Telegram account for an approved contact or channel
 */
export async function syncMessagesFromTelegram(peerId: string, peerUsername: string, customSessionString?: string): Promise<Message[]> {
  const isDemo = !customSessionString || customSessionString.startsWith('mock_') || customSessionString.startsWith('demo_');
  if (isDemo) {
    const cached = getPeerMessages(peerId);
    if (cached.length > 0) return cached;

    // Seed informative starter dispatches for channels/groups in demo mode
    const demoMessages: Message[] = [
      {
        id: `demo-${peerId}-1`,
        peerId,
        senderId: peerId,
        senderName: peerUsername || 'Channel',
        isOutgoing: false,
        text: 'Welcome to this channel. All posts, announcements, and media shared here are streamed directly to your focus view.',
        date: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: `demo-${peerId}-2`,
        peerId,
        senderId: peerId,
        senderName: peerUsername || 'Channel',
        isOutgoing: false,
        text: 'Focus mode is active: notifications are preview-free and unread indicators appear only when deliberate attention is warranted.',
        date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
    ];
    saveRealTelegramMessages(peerId, demoMessages);
    return demoMessages;
  }

  const client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) {
    return [];
  }

  try {
    const cleanUsername = peerUsername ? peerUsername.replace(/^@/, '').trim().toLowerCase() : '';
    const cleanRawId = peerId
      .replace(/^contact-/, '')
      .replace(/^channel-/, '')
      .replace(/^user_/, '')
      .replace(/^private_/, '')
      .replace(/^-100/, '')
      .replace(/^-/, '')
      .toLowerCase();
    let entity: unknown = null;

    // 1. Try resolving by public username first (instant MTProto resolution)
    if (cleanUsername && !cleanUsername.startsWith('user_') && !cleanUsername.startsWith('private_')) {
      try {
        entity = await client.getEntity(cleanUsername);
      } catch {
        // Fall back to dialog enumeration
      }
    }

    // 2. Search dialogs if not resolved by username (dialogs contain accessHash for private channels/groups)
    if (!entity) {
      try {
        const dialogs = await client.getDialogs({ limit: 120 });
        const matched = dialogs.find((d) => {
          const dEntity = d.entity as unknown as { id?: { toString: () => string }; username?: string; title?: string };
          const dIdStr = d.id ? d.id.toString() : (dEntity?.id ? dEntity.id.toString() : '');
          const cleanDId = dIdStr.replace(/^-100/, '').replace(/^-/, '').toLowerCase();
          const dUser = dEntity?.username?.toLowerCase();
          return (
            cleanDId === cleanRawId ||
            (cleanUsername && !cleanUsername.startsWith('user_') && !cleanUsername.startsWith('private_') && dUser === cleanUsername)
          );
        });

        if (matched) {
          entity = matched.inputEntity || matched.entity;
        }
      } catch (dErr) {
        console.warn('Dialog search notice in syncMessagesFromTelegram:', dErr);
      }
    }

    // 3. Fallback: try resolving by numerical ID (-100 and clean)
    if (!entity && cleanRawId) {
      try {
        entity = await client.getEntity(`-100${cleanRawId}`);
      } catch {
        try {
          entity = await client.getEntity(cleanRawId);
        } catch {
          // ignore
        }
      }
    }

    if (!entity) {
      console.warn(`Could not resolve entity for peerId: ${peerId}, username: ${peerUsername}`);
      return [];
    }

    const tgMessages = await client.getMessages(entity as Parameters<typeof client.getMessages>[0], { limit: 50 });
    const me = (await client.getMe()) as unknown as { id: { toString: () => string }; firstName?: string };
    const myId = me?.id ? me.id.toString() : 'me';

    const synced: Message[] = [];
    for (const msg of tgMessages) {
      const textContent = (msg as unknown as { message?: string }).message || '';
      const mediaObj = (msg as unknown as { media?: { className?: string } }).media;
      if (!textContent && !mediaObj) continue;

      const isOut = Boolean((msg as unknown as { out?: boolean }).out);
      const unixDate = (msg as unknown as { date: number }).date;
      const mDate = unixDate ? new Date(unixDate * 1000).toISOString() : new Date().toISOString();
      const msgId = (msg as unknown as { id: number }).id;

      // Extract sender's actual display name (especially useful for group chats)
      const senderObj = (msg as unknown as { sender?: { firstName?: string; lastName?: string; title?: string } }).sender;
      let senderDisplayName = isOut ? 'You' : '';
      if (!isOut) {
        if (senderObj?.firstName) {
          senderDisplayName = `${senderObj.firstName} ${senderObj.lastName || ''}`.trim();
        } else if (senderObj?.title) {
          senderDisplayName = senderObj.title;
        } else {
          senderDisplayName = cleanUsername || 'Member';
        }
      }

      let parsedMedia = undefined;
      if (mediaObj) {
        const isPhoto = mediaObj.className === 'MessageMediaPhoto';
        const isDoc = mediaObj.className === 'MessageMediaDocument';
        let mediaType: 'image' | 'document' | 'voice' | 'video' = 'document';
        let mediaName = 'Document attachment';
        let mediaSize: string | undefined = undefined;

        if (isPhoto) {
          mediaType = 'image';
          mediaName = 'Photo';
        } else if (isDoc) {
          const doc = (mediaObj as unknown as { document?: { mimeType?: string; size?: number } })?.document;
          const mime = doc?.mimeType || '';
          if (mime.startsWith('image/')) {
            mediaType = 'image';
            mediaName = 'Image';
          } else if (mime.startsWith('audio/') || mime === 'audio/ogg') {
            mediaType = 'voice';
            mediaName = 'Voice note';
          } else if (mime.startsWith('video/')) {
            mediaType = 'video';
            mediaName = 'Video';
          } else {
            mediaType = 'document';
            mediaName = 'Document';
          }
          if (doc?.size) {
            mediaSize = `${(doc.size / (1024 * 1024)).toFixed(1)} MB`;
          }
        }

        parsedMedia = {
          type: mediaType,
          name: mediaName,
          size: mediaSize,
          url: `/api/telegram/media?peerId=${encodeURIComponent(peerId)}&messageId=${msgId}`,
        };
      }

      const newMsg: Message = {
        id: `tg-${peerId}-${msgId}`,
        peerId,
        senderId: isOut ? myId : peerId,
        senderName: senderDisplayName,
        isOutgoing: isOut,
        text: textContent || (parsedMedia ? `📎 [${parsedMedia.name}]` : ''),
        date: mDate,
        media: parsedMedia,
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
  isUser: boolean;
  unreadCount: number;
}

/**
 * Retrieve user's joined Telegram dialogs (groups, channels, and 1-on-1 chats) to allow selectively adding them
 */
export async function getMyTelegramDialogs(customSessionString?: string): Promise<TelegramJoinedDialog[]> {
  const isDemo = !customSessionString || customSessionString.startsWith('mock_') || customSessionString.startsWith('demo_');

  // If in sandbox mode, provide interactive sample groups and contacts to explore
  if (isDemo) {
    return [
      {
        id: 'group-101',
        title: 'Work Project Discussion',
        isGroup: true,
        isChannel: false,
        isPrivate: true,
        isUser: false,
        unreadCount: 0,
      },
      {
        id: 'group-102',
        title: 'Family Chat',
        isGroup: true,
        isChannel: false,
        isPrivate: true,
        isUser: false,
        unreadCount: 0,
      },
      {
        id: 'channel-103',
        title: 'Technology & AI News',
        username: 'tech_ai_news',
        isGroup: false,
        isChannel: true,
        isPrivate: false,
        isUser: false,
        unreadCount: 0,
      },
      {
        id: 'user-201',
        title: 'Abebe Kebede',
        username: 'abebe_k',
        isGroup: false,
        isChannel: false,
        isPrivate: false,
        isUser: true,
        unreadCount: 0,
      },
      {
        id: 'user-202',
        title: 'Sara Mohammed',
        username: 'sara_m',
        isGroup: false,
        isChannel: false,
        isPrivate: false,
        isUser: true,
        unreadCount: 0,
      },
    ];
  }

  const client = await getOrInitTelegramClient(customSessionString);
  if (client && client.connected) {
    try {
      const dialogs = await client.getDialogs({ limit: 150 });
      const results: TelegramJoinedDialog[] = [];

      for (const d of dialogs) {
        const isChannel = Boolean(d.isChannel);
        const isGroup = Boolean(d.isGroup);
        const isUser = Boolean(d.isUser);

        if (!isChannel && !isGroup && !isUser) continue;
        if (d.id && d.id.toString() === '777000') continue; // Telegram service notices

        const entity = d.entity as unknown as {
          id?: { toString: () => string };
          title?: string;
          firstName?: string;
          lastName?: string;
          username?: string;
          megagroup?: boolean;
          broadcast?: boolean;
        };

        const idStr = d.id ? d.id.toString() : (entity?.id ? entity.id.toString() : '');
        if (!idStr) continue;

        let title = d.title || entity?.title || '';
        if (!title && isUser) {
          title = `${entity?.firstName || ''} ${entity?.lastName || ''}`.trim() || 'Telegram Contact';
        }

        const username = entity?.username || undefined;
        const isPrivate = !username;

        results.push({
          id: idStr,
          title: title || (isUser ? 'Telegram User' : 'Telegram Chat'),
          username,
          isGroup: isGroup || Boolean(entity?.megagroup),
          isChannel: isChannel && !entity?.megagroup,
          isPrivate,
          isUser,
          unreadCount: d.unreadCount || 0,
        });
      }

      return results;
    } catch (err) {
      console.warn('Telegram getDialogs error:', err);
    }
  }

  return [];
}

/**
 * Post a photo story to user's Telegram profile
 */
export async function postTelegramStory(params: {
  mediaDataUrl: string;
  caption?: string;
  customSessionString?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const { mediaDataUrl, caption, customSessionString } = params;

  const isDemo = !customSessionString || customSessionString.startsWith('mock_') || customSessionString.startsWith('demo_');
  if (isDemo) {
    return {
      success: true,
      message: 'Story posted successfully (Sandbox Preview mode)!',
    };
  }

  const client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) {
    return {
      success: false,
      error: 'Not connected to Telegram. Please reconnect your account using the Connect button.',
    };
  }

  if (!client || !client.connected) {
    return { success: false, error: 'Telegram account not connected' };
  }

  try {
    const matches = mediaDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || !matches[2]) {
      return { success: false, error: 'Invalid image format. Please select a valid photo.' };
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const { CustomFile } = await import('telegram/client/uploads');
    const uploadedFile = await client.uploadFile({
      file: new CustomFile(`story_${Date.now()}.jpg`, buffer.length, '', buffer),
      workers: 1,
    });

    await client.invoke(
      new Api.stories.SendStory({
        peer: 'me',
        media: new Api.InputMediaUploadedPhoto({
          file: uploadedFile,
        }),
        caption: caption ? caption.trim() : '',
        privacyRules: [new Api.InputPrivacyValueAllowAll()],
        period: 86400, // 24 hours
      })
    );

    return { success: true, message: 'Story posted to your Telegram profile successfully!' };
  } catch (err: unknown) {
    console.error('Failed to post Telegram story:', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('PREMIUM_ACCOUNT_REQUIRED')) {
      return {
        success: false,
        error: 'Telegram requires a Telegram Premium subscription to post stories from this account.',
      };
    }
    return { success: false, error: `Failed to post story: ${msg}` };
  }
}

/**
 * Synchronize real Telegram unread status:
 * 1. If any real PERSON sends a direct message (1-on-1 chat), it automatically arrives in the app with unread status so the user can read and reply.
 * 2. Strictly excludes channels and groups from auto-adding (channels/groups only appear if user approved them).
 */
export async function syncContactUnreadStatusFromTelegram(customSessionString?: string): Promise<void> {
  const client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) return;

  try {
    const dialogs = await client.getDialogs({ limit: 120 });
    const approvedContacts = getApprovedContacts();
    const approvedMap = new Map<string, ApprovedContact>();

    for (const c of approvedContacts) {
      const cleanId = c.id.replace(/^contact-/, '').replace(/^-100/, '').replace(/^-/, '').toLowerCase();
      approvedMap.set(cleanId, c);
      if (c.username) {
        approvedMap.set(c.username.toLowerCase().replace(/^@/, ''), c);
      }
    }

    // Process all 1-on-1 person chats (d.isUser === true)
    for (const d of dialogs) {
      // STRICT FILTER: Only real individual people! Never auto-import channels or groups!
      if (!d.isUser) continue;
      if (d.id && d.id.toString() === '777000') continue; // Skip Telegram service notifications

      const entity = d.entity as unknown as {
        id?: { toString: () => string };
        firstName?: string;
        lastName?: string;
        username?: string;
        phone?: string;
      };

      const dIdStr = d.id ? d.id.toString() : (entity?.id ? entity.id.toString() : '');
      if (!dIdStr) continue;

      const cleanId = dIdStr.replace(/^-100/, '').replace(/^-/, '');
      const dUsername = entity?.username ? entity.username.replace(/^@/, '').trim() : '';
      const existing = approvedMap.get(cleanId.toLowerCase()) ||
        (dUsername ? approvedMap.get(dUsername.toLowerCase()) : undefined);

      const unreadCount = d.unreadCount || 0;
      const status = unreadCount > 0 ? ('new_message' as const) : ('no_new_message' as const);

      if (existing) {
        updateContactStatus(existing.id, status, unreadCount);
      } else if (unreadCount > 0) {
        // Direct unread message from an individual person: automatically bring them into the app so user can read and reply!
        let displayName = `${entity?.firstName || ''} ${entity?.lastName || ''}`.trim();
        if (!displayName && d.title) displayName = d.title.trim();
        if (!displayName) displayName = dUsername || `User ${cleanId}`;

        const newContact: ApprovedContact = {
          id: `contact-${cleanId}`,
          username: dUsername || `user_${cleanId}`,
          firstName: displayName,
          lastName: '',
          phone: entity?.phone || '',
          status,
          unreadCount,
          notificationsEnabled: true,
          addedAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
        };

        addApprovedContact(newContact);
        approvedMap.set(cleanId.toLowerCase(), newContact);
        if (dUsername) approvedMap.set(dUsername.toLowerCase(), newContact);
      }
    }
  } catch (err) {
    console.warn('Real telegram unread status sync notice:', err);
  }
}
