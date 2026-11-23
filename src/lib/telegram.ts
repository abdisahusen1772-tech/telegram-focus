import { TelegramClient, Api, sessions } from 'telegram';
const { StringSession } = sessions;
import { getUserSession, setUserSession, getApiCredentials, setApiCredentials, saveRealTelegramMessages, getApprovedContacts, updateContactStatus, addApprovedContact, getPeerMessages } from './db';
import { ApprovedContact, ApprovedChannel, Message, UserSession } from './types';

// In-memory active client reference
let activeClient: TelegramClient | null = null;
let connectingPromise: Promise<TelegramClient | null> | null = null;
let lastSessionUsed: string | null = null;
let lastApiIdUsed: number | null = null;
let currentPhoneCodeHash: string | null = null;
let currentPhoneNumber: string | null = null;
let lastUnreadSyncTime = 0;

export function formatTelegramError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_ID_INVALID') || msg.includes('API_ID_PUBLISHED_FLOOD')) {
    return 'Invalid Telegram API ID or API Hash. Please verify your App api_id and App api_hash from https://my.telegram.org (under API Development Tools).';
  }
  if (msg.includes('PHONE_NUMBER_INVALID')) {
    return 'Invalid phone number format. Please ensure your international country code is included (e.g. +251 9... or +1...).';
  }
  if (msg.includes('PHONE_CODE_INVALID')) {
    return 'Incorrect Telegram verification code. Please check your Telegram app messages and enter the latest code.';
  }
  if (msg.includes('PHONE_CODE_EXPIRED')) {
    return 'The verification code has expired. Please go back and request a new code.';
  }
  if (msg.includes('PHONE_NUMBER_BANNED')) {
    return 'This phone number has been banned or restricted by Telegram.';
  }
  if (msg.includes('PHONE_NUMBER_FLOOD')) {
    return 'Telegram rate limit: Too many code requests recently. Telegram requires you to wait before requesting another code. Please check your Telegram app notifications on your existing devices.';
  }
  if (msg.includes('FLOOD_WAIT')) {
    const match = msg.match(/FLOOD_WAIT_(\d+)/i) || msg.match(/(\d+)\s*seconds/i);
    const sec = match ? match[1] : 'a few';
    return `Telegram rate limit: please wait ${sec} seconds before trying again.`;
  }
  if (msg.includes('PASSWORD_HASH_INVALID')) {
    return 'Incorrect Two-Factor Authentication (2FA) password. Please try again.';
  }
  if (msg.includes('AUTH_KEY_UNREGISTERED')) {
    return 'Your Telegram session has been invalidated or revoked. Please log in again.';
  }
  return msg;
}

/**
 * Universal phone number normalizer with comprehensive Ethiopian and international support
 */
export function normalizePhoneNumber(raw: string): string {
  let clean = (raw || '').trim().replace(/[\s\-\(\)\.]/g, '');
  if (!clean) return '';

  // Ethiopian 10-digit format with leading zero: 09XXXXXXXX or 07XXXXXXXX
  if (/^0[79]\d{8}$/.test(clean)) {
    return '+251' + clean.slice(1);
  }
  // Ethiopian 9-digit format without leading zero: 9XXXXXXXX or 7XXXXXXXX
  if (/^[79]\d{8}$/.test(clean)) {
    return '+251' + clean;
  }
  // Ethiopian with 251 prefix but no +: 2519XXXXXXXX or 2517XXXXXXXX
  if (/^251[79]\d{8}$/.test(clean)) {
    return '+' + clean;
  }
  // If already starts with +, keep it
  if (clean.startsWith('+')) {
    return clean;
  }
  // Otherwise prepend +
  return '+' + clean;
}

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

  // If activeClient is already connected for this session and matching apiId, reuse immediately
  if (activeClient && activeClient.connected && lastSessionUsed === sessionString && lastApiIdUsed === apiId) {
    return activeClient;
  }

  // If already connecting for this session and apiId, share in-flight promise to avoid MTProto collision
  if (connectingPromise && lastSessionUsed === sessionString && lastApiIdUsed === apiId) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    lastSessionUsed = sessionString;
    lastApiIdUsed = apiId;

    // Disconnect any stale or mismatched client cleanly
    if (activeClient) {
      try {
        await activeClient.disconnect();
      } catch {}
      activeClient = null;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const stringSession = new StringSession(sessionString);
        const client = new TelegramClient(stringSession, apiId, apiHash, {
          connectionRetries: 3,
          autoReconnect: true,
          timeout: 15,
        });

        const connectPromise = client.connect();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('MTProto connection timeout (20s)')), 20000)
        );

        await Promise.race([connectPromise, timeoutPromise]);
        activeClient = client;
        return client;
      } catch (err: unknown) {
        const errStr = String(err);
        console.warn(`MTProto connect attempt ${attempt} notice:`, errStr);

        if (errStr.includes('AUTH_KEY_DUPLICATED') && attempt < 3) {
          // Add random jitter 1200-2200ms to allow concurrent lambda to release session
          const delay = 1200 + Math.floor(Math.random() * 1000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (attempt === 3) {
          return null;
        }
      }
    }
    return null;
  })();

  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
}

/**
 * Phase 1: Send Telegram authentication verification code to phone number via MTProto
 */
export async function sendTelegramVerificationCode(phoneNumber: string, apiIdParam?: string, apiHashParam?: string): Promise<{
  success: boolean;
  phoneCodeHash?: string;
  intermediateSession?: string;
  isRegistered?: boolean;
  isCodeViaApp?: boolean;
  deliveryType?: 'app' | 'sms';
  formattedPhone?: string;
  error?: string;
  isMock?: boolean;
}> {
  const cleanPhone = normalizePhoneNumber(phoneNumber);

  if (apiIdParam && apiHashParam) {
    setApiCredentials(apiIdParam, apiHashParam);
  }

  const creds = getActiveApiCredentials();

  // If real Telegram API credentials are configured, execute authentic MTProto call
  if (creds) {
    try {
      const { apiId, apiHash } = creds;

      if (activeClient) {
        try {
          await activeClient.disconnect();
        } catch {}
        activeClient = null;
      }

      const stringSession = new StringSession('');
      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
        timeout: 15,
      });

      await client.connect();
      activeClient = client;
      lastApiIdUsed = apiId;

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
        isCodeViaApp: Boolean(result.isCodeViaApp),
        deliveryType: result.isCodeViaApp ? 'app' : 'sms',
        formattedPhone: cleanPhone,
        isMock: false,
      };
    } catch (err: unknown) {
      console.error('Telegram MTProto sendCode error:', err);
      const errorMessage = formatTelegramError(err);
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
    isCodeViaApp: false,
    deliveryType: 'sms',
    formattedPhone: cleanPhone,
    isMock: true,
  };
}

/**
 * Resend Telegram verification code via SMS if not received in app
 */
export async function resendTelegramVerificationCode(params: {
  phoneNumber: string;
  phoneCodeHash: string;
  intermediateSession?: string;
  apiId?: string | number;
  apiHash?: string;
}): Promise<{
  success: boolean;
  phoneCodeHash?: string;
  isCodeViaApp?: boolean;
  error?: string;
}> {
  const { phoneNumber, phoneCodeHash, intermediateSession, apiId: paramApiId, apiHash: paramApiHash } = params;
  const cleanPhone = normalizePhoneNumber(phoneNumber);

  if (paramApiId && paramApiHash) {
    setApiCredentials(String(paramApiId).trim(), String(paramApiHash).trim());
  }

  const creds = getActiveApiCredentials();
  if (creds) {
    try {
      const { apiId, apiHash } = creds;

      if (!activeClient || !activeClient.connected || lastApiIdUsed !== apiId) {
        if (activeClient) {
          try { await activeClient.disconnect(); } catch {}
          activeClient = null;
        }
        const stringSession = new StringSession(intermediateSession || '');
        activeClient = new TelegramClient(stringSession, apiId, apiHash, {
          connectionRetries: 3,
          timeout: 15,
        });
        await activeClient.connect();
        lastApiIdUsed = apiId;
      }

      const resendResult = await activeClient.invoke(
        new Api.auth.ResendCode({
          phoneNumber: cleanPhone,
          phoneCodeHash,
        })
      );

      const resendObj = resendResult as any;
      return {
        success: true,
        phoneCodeHash: resendObj.phoneCodeHash || phoneCodeHash,
        isCodeViaApp: resendObj.type instanceof Api.auth.SentCodeTypeApp,
      };
    } catch (err: unknown) {
      console.error('Telegram MTProto resendCode error:', err);
      const errorMessage = formatTelegramError(err);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  return {
    success: true,
    phoneCodeHash,
    isCodeViaApp: false,
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
  apiId?: string | number;
  apiHash?: string;
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
  const { phoneNumber, phoneCode, phoneCodeHash, password, intermediateSession, apiId: paramApiId, apiHash: paramApiHash } = params;

  if (paramApiId && paramApiHash) {
    setApiCredentials(String(paramApiId).trim(), String(paramApiHash).trim());
  }

  const cleanPhone = normalizePhoneNumber(phoneNumber);

  const creds = getActiveApiCredentials();
  if (creds) {
    try {
      const { apiId, apiHash } = creds;

      if (!activeClient || !activeClient.connected || lastApiIdUsed !== apiId) {
        if (activeClient) {
          try {
            await activeClient.disconnect();
          } catch {}
          activeClient = null;
        }
        const stringSession = new StringSession(intermediateSession || '');
        activeClient = new TelegramClient(stringSession, apiId, apiHash, {
          connectionRetries: 3,
          timeout: 15,
        });
        await activeClient.connect();
        lastApiIdUsed = apiId;
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
        } else if (
          errMsg.includes('SOCKET') ||
          errMsg.includes('TIMEOUT') ||
          errMsg.includes('closed') ||
          errMsg.includes('Connection') ||
          errMsg.includes('AUTH_KEY_DUPLICATED')
        ) {
          // Automatic reconnect & retry if connection went idle or switched lambdas
          if (activeClient) {
            try { await activeClient.disconnect(); } catch {}
            activeClient = null;
          }
          const stringSession = new StringSession(intermediateSession || '');
          activeClient = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 3,
            timeout: 15,
          });
          await activeClient.connect();
          lastApiIdUsed = apiId;

          await activeClient.invoke(
            new Api.auth.SignIn({
              phoneNumber: cleanPhone,
              phoneCodeHash,
              phoneCode: phoneCode.trim(),
            })
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
      const errorMessage = formatTelegramError(err);
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
 * Send message to an approved contact, channel, or group with support for silent send, scheduling, topics, and replies
 */
export async function sendTelegramMessage(
  peerUsername: string,
  text: string,
  media?: { type: 'image' | 'video' | 'voice' | 'document'; url: string; name?: string },
  customSessionString?: string,
  topicId?: number,
  options?: {
    silent?: boolean;
    scheduleDate?: number;
    replyToMsgId?: number;
  }
): Promise<boolean> {
  const client = await getOrInitTelegramClient(customSessionString);
  if (client && client.connected) {
    try {
      const cleanUsername = peerUsername ? peerUsername.replace(/^@/, '').trim().toLowerCase() : '';
      const rawUsername = peerUsername ? peerUsername.replace(/^@/, '').trim() : '';
      const cleanRawId = peerUsername
        .replace(/^contact-/, '')
        .replace(/^channel-/, '')
        .replace(/^user_/, '')
        .replace(/^private_/, '')
        .replace(/^-100/, '')
        .replace(/^-/, '')
        .toLowerCase();
      const cleanPhoneDigits = cleanRawId.replace(/[^0-9]/g, '');
      let entity: any = null;

      // 1. If username is available and public, resolve via MTProto ResolveUsername or getEntity
      const isPublicUser = Boolean(rawUsername && !rawUsername.startsWith('user_') && !rawUsername.startsWith('private_'));
      if (isPublicUser) {
        try {
          const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username: rawUsername })) as any;
          if (resolved.users && resolved.users.length > 0) {
            const u = resolved.users[0];
            entity = new Api.InputPeerUser({ userId: u.id, accessHash: u.accessHash || (BigInt(0) as any) });
          } else if (resolved.chats && resolved.chats.length > 0) {
            const ch = resolved.chats[0];
            if (ch instanceof Api.Channel || ch.broadcast) {
              entity = new Api.InputPeerChannel({ channelId: ch.id, accessHash: ch.accessHash || (BigInt(0) as any) });
            } else {
              entity = new Api.InputPeerChat({ chatId: ch.id });
            }
          }
        } catch {
          try {
            entity = await client.getEntity(rawUsername);
          } catch {
            try {
              entity = await client.getEntity(cleanUsername);
            } catch {}
          }
        }
      }

      // 2. Search dialogs (contains accessHash for private chats/groups)
      if (!entity) {
        try {
          const dialogs = await client.getDialogs({ limit: 150 });
          const matched = dialogs.find((d) => {
            const dEntity = d.entity as any;
            const dIdStr = d.id ? d.id.toString() : (dEntity?.id ? dEntity.id.toString() : '');
            const cleanDId = dIdStr.replace(/^-100/, '').replace(/^-/, '').toLowerCase();
            const dUser = dEntity?.username?.toLowerCase();
            const dName = (d.name || d.title || `${dEntity?.firstName || ''} ${dEntity?.lastName || ''}`).toLowerCase().trim();
            const dPhone = (dEntity?.phone || '').replace(/[^0-9]/g, '');

            return (
              cleanDId === cleanRawId ||
              (isPublicUser && dUser === cleanUsername) ||
              (cleanUsername && dUser === cleanUsername) ||
              (cleanPhoneDigits.length >= 7 && dPhone && dPhone === cleanPhoneDigits) ||
              (cleanRawId && dName && (dName === cleanRawId || dName.includes(cleanRawId))) ||
              (cleanUsername && dName && (dName === cleanUsername || dName.includes(cleanUsername)))
            );
          });
          if (matched) {
            if (matched.inputEntity) {
              entity = matched.inputEntity;
            } else if (matched.entity) {
              const e = matched.entity as any;
              if (e.accessHash) {
                if (matched.isUser || e instanceof Api.User) {
                  entity = new Api.InputPeerUser({ userId: e.id, accessHash: e.accessHash });
                } else if (matched.isChannel || e instanceof Api.Channel) {
                  entity = new Api.InputPeerChannel({ channelId: e.id, accessHash: e.accessHash });
                } else {
                  entity = new Api.InputPeerChat({ chatId: e.id });
                }
              } else {
                entity = matched.entity;
              }
            }
          }
        } catch (dErr) {
          console.warn('Dialog search notice in sendTelegramMessage:', dErr);
        }
      }

      // 3. Search Telegram Contacts (Api.contacts.GetContacts) for 1-on-1 contacts
      if (!entity) {
        try {
          const contactsRes = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) as any })) as any;
          if (contactsRes && Array.isArray(contactsRes.users)) {
            const matchedUser = contactsRes.users.find((u: any) => {
              const uId = u.id ? u.id.toString() : '';
              const uUser = (u.username || '').toLowerCase();
              const uName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
              const uPhone = (u.phone || '').replace(/[^0-9]/g, '');

              return (
                uId === cleanRawId ||
                (cleanUsername && uUser === cleanUsername) ||
                (cleanPhoneDigits.length >= 7 && uPhone && uPhone === cleanPhoneDigits) ||
                (cleanRawId && uName && (uName === cleanRawId || uName.includes(cleanRawId)))
              );
            });

            if (matchedUser && matchedUser.accessHash) {
              entity = new Api.InputPeerUser({ userId: matchedUser.id, accessHash: matchedUser.accessHash });
            }
          }
        } catch (cErr) {
          console.warn('GetContacts notice in sendTelegramMessage:', cErr);
        }
      }

      // 4. Fallback: try getInputEntity or getEntity by cleanRawId / -100
      if (!entity && cleanRawId) {
        try {
          entity = await client.getInputEntity(`-100${cleanRawId}`);
        } catch {
          try {
            entity = await client.getInputEntity(cleanRawId);
          } catch {
            try {
              entity = await client.getEntity(`-100${cleanRawId}`);
            } catch {
              try {
                entity = await client.getEntity(cleanRawId);
              } catch {}
            }
          }
        }
      }

      if (!entity) {
        console.warn('Could not resolve entity to send Telegram message:', peerUsername);
        return false;
      }

      const replyTarget = options?.replyToMsgId ? Number(options.replyToMsgId) : (topicId ? Number(topicId) : undefined);

      if (media && media.url && media.url.startsWith('data:')) {
        try {
          const matches = media.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches[2]) {
            const buffer = Buffer.from(matches[2], 'base64');
            await client.sendFile(entity as any, {
              file: buffer,
              caption: text || (media.name ? `📎 ${media.name}` : undefined),
              replyTo: replyTarget,
              silent: options?.silent,
              scheduleDate: options?.scheduleDate,
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
        replyTo: replyTarget,
        silent: options?.silent,
        schedule: options?.scheduleDate,
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
 * Dispatch reaction to a message via Telegram MTProto
 */
export async function reactToTelegramMessage(
  peerUsername: string,
  msgId: number,
  emoji: string,
  customSessionString?: string
): Promise<boolean> {
  const client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) return true;

  try {
    const cleanUsername = peerUsername ? peerUsername.replace(/^@/, '').trim().toLowerCase() : '';
    let entity: any = null;
    if (cleanUsername) {
      try {
        entity = await client.getEntity(cleanUsername);
      } catch {}
    }
    if (!entity) {
      const dialogs = await client.getDialogs({ limit: 60 });
      const matched = dialogs.find(d => {
        const dId = d.id ? d.id.toString() : '';
        return dId.includes(peerUsername.replace(/[^\d]/g, ''));
      });
      if (matched) entity = matched.inputEntity || matched.entity;
    }
    if (!entity) return false;

    await client.invoke(
      new Api.messages.SendReaction({
        peer: entity,
        msgId,
        reaction: [new Api.ReactionEmoji({ emoticon: emoji })],
      })
    );
    return true;
  } catch (err) {
    console.warn('Telegram sendReaction notice:', err);
    return false;
  }
}

/**
 * Pin or unpin a message in Telegram MTProto
 */
export async function pinTelegramMessage(
  peerUsername: string,
  msgId: number,
  unpin = false,
  customSessionString?: string
): Promise<boolean> {
  const client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) return true;

  try {
    const cleanUsername = peerUsername ? peerUsername.replace(/^@/, '').trim().toLowerCase() : '';
    let entity: any = null;
    if (cleanUsername) {
      try {
        entity = await client.getEntity(cleanUsername);
      } catch {}
    }
    if (!entity) {
      const dialogs = await client.getDialogs({ limit: 60 });
      const matched = dialogs.find(d => {
        const dId = d.id ? d.id.toString() : '';
        return dId.includes(peerUsername.replace(/[^\d]/g, ''));
      });
      if (matched) entity = matched.inputEntity || matched.entity;
    }
    if (!entity) return false;

    await client.invoke(
      new Api.messages.UpdatePinnedMessage({
        peer: entity,
        id: msgId,
        unpin,
        silent: true,
      })
    );
    return true;
  } catch (err) {
    console.warn('Telegram updatePinnedMessage notice:', err);
    return false;
  }
}

/**
 * Fetch live messages from real Telegram account for an approved contact or channel
 */
export async function syncMessagesFromTelegram(
  peerId: string,
  peerUsername: string,
  customSessionString?: string,
  topicId?: number
): Promise<Message[]> {
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
        text: 'Welcome to this channel. All posts, announcements, and media shared here are streamed directly to your focus view. Check out [Official Documentation](https://telegram.org) for more tips.',
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
    const rawUsername = peerUsername ? peerUsername.replace(/^@/, '').trim() : '';
    const cleanRawId = peerId
      .replace(/^contact-/, '')
      .replace(/^channel-/, '')
      .replace(/^user_/, '')
      .replace(/^private_/, '')
      .replace(/^-100/, '')
      .replace(/^-/, '')
      .toLowerCase();
    const cleanPhoneDigits = cleanRawId.replace(/[^0-9]/g, '');
    let entity: any = null;

    // 1. Try public username if available (not placeholder)
    const isPublicUser = Boolean(rawUsername && !rawUsername.startsWith('user_') && !rawUsername.startsWith('private_'));
    if (isPublicUser) {
      try {
        const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username: rawUsername })) as any;
        if (resolved.users && resolved.users.length > 0) {
          const u = resolved.users[0];
          entity = new Api.InputPeerUser({ userId: u.id, accessHash: u.accessHash || (BigInt(0) as any) });
        } else if (resolved.chats && resolved.chats.length > 0) {
          const ch = resolved.chats[0];
          if (ch instanceof Api.Channel || ch.broadcast) {
            entity = new Api.InputPeerChannel({ channelId: ch.id, accessHash: ch.accessHash || (BigInt(0) as any) });
          } else {
            entity = new Api.InputPeerChat({ chatId: ch.id });
          }
        }
      } catch {
        try {
          entity = await client.getEntity(rawUsername);
        } catch {
          try {
            entity = await client.getEntity(cleanUsername);
          } catch {}
        }
      }
    }

    // 2. Search dialogs (contains pre-resolved accessHash for private contacts and supergroups)
    if (!entity) {
      try {
        const dialogs = await client.getDialogs({ limit: 150 });
        const matched = dialogs.find((d) => {
          const dEntity = d.entity as any;
          const dIdStr = d.id ? d.id.toString() : (dEntity?.id ? dEntity.id.toString() : '');
          const cleanDId = dIdStr.replace(/^-100/, '').replace(/^-/, '').toLowerCase();
          const dUser = dEntity?.username?.toLowerCase();
          const dName = (d.name || d.title || `${dEntity?.firstName || ''} ${dEntity?.lastName || ''}`).toLowerCase().trim();
          const dPhone = (dEntity?.phone || '').replace(/[^0-9]/g, '');

          return (
            cleanDId === cleanRawId ||
            (isPublicUser && dUser === cleanUsername) ||
            (cleanUsername && dUser === cleanUsername) ||
            (cleanPhoneDigits.length >= 7 && dPhone && dPhone === cleanPhoneDigits) ||
            (cleanRawId && dName && (dName === cleanRawId || dName.includes(cleanRawId))) ||
            (cleanUsername && dName && (dName === cleanUsername || dName.includes(cleanUsername)))
          );
        });

        if (matched) {
          if (matched.inputEntity) {
            entity = matched.inputEntity;
          } else if (matched.entity) {
            const e = matched.entity as any;
            if (e.accessHash) {
              if (matched.isUser || e instanceof Api.User) {
                entity = new Api.InputPeerUser({ userId: e.id, accessHash: e.accessHash });
              } else if (matched.isChannel || e instanceof Api.Channel) {
                entity = new Api.InputPeerChannel({ channelId: e.id, accessHash: e.accessHash });
              } else {
                entity = new Api.InputPeerChat({ chatId: e.id });
              }
            } else {
              entity = matched.entity;
            }
          }
        }
      } catch (dErr) {
        console.warn('Dialog search notice in syncMessagesFromTelegram:', dErr);
      }
    }

    // 3. Search Telegram Contacts (Api.contacts.GetContacts) for individual contacts
    if (!entity) {
      try {
        const contactsRes = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) as any })) as any;
        if (contactsRes && Array.isArray(contactsRes.users)) {
          const matchedUser = contactsRes.users.find((u: any) => {
            const uId = u.id ? u.id.toString() : '';
            const uUser = (u.username || '').toLowerCase();
            const uName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
            const uPhone = (u.phone || '').replace(/[^0-9]/g, '');

            return (
              uId === cleanRawId ||
              (cleanUsername && uUser === cleanUsername) ||
              (cleanPhoneDigits.length >= 7 && uPhone && uPhone === cleanPhoneDigits) ||
              (cleanRawId && uName && (uName === cleanRawId || uName.includes(cleanRawId)))
            );
          });

          if (matchedUser && matchedUser.accessHash) {
            entity = new Api.InputPeerUser({ userId: matchedUser.id, accessHash: matchedUser.accessHash });
          }
        }
      } catch (cErr) {
        console.warn('GetContacts notice in syncMessagesFromTelegram:', cErr);
      }
    }

    // 4. Fallback: try getInputEntity or getEntity by cleanRawId / -100
    if (!entity && cleanRawId) {
      try {
        entity = await client.getInputEntity(`-100${cleanRawId}`);
      } catch {
        try {
          entity = await client.getInputEntity(cleanRawId);
        } catch {
          try {
            entity = await client.getEntity(`-100${cleanRawId}`);
          } catch {
            try {
              entity = await client.getEntity(cleanRawId);
            } catch {}
          }
        }
      }
    }

    // 5. Fetch messages (supports topic/forum filter via replyTo)
    const getOptions: Record<string, any> = { limit: 50 };
    if (topicId && Number(topicId) > 0) {
      getOptions.replyTo = Number(topicId);
    }

    let tgMessages: unknown[] = [];
    if (entity) {
      tgMessages = await client.getMessages(entity as Parameters<typeof client.getMessages>[0], getOptions);
    } else if (isPublicUser) {
      try {
        tgMessages = await client.getMessages(rawUsername, getOptions);
      } catch {
        try {
          tgMessages = await client.getMessages(cleanUsername, getOptions);
        } catch (mErr) {
          console.warn('Direct username getMessages notice:', mErr);
        }
      }
    }

    if (!tgMessages || tgMessages.length === 0) {
      console.warn(`No messages returned for peerId: ${peerId}, username: ${peerUsername}`);
      return [];
    }

    const myId = 'me';

    const synced: Message[] = [];
    for (const msg of tgMessages) {
      const msgObj = msg as Record<string, any>;
      let textContent = msgObj.message || msgObj.text || '';
      const mediaObj = msgObj.media;
      const fwdObj = msgObj.fwdFrom || msgObj.forward;

      // Extract text links from Telegram entities (convert MessageEntityTextUrl into markdown [text](url))
      const entities = msgObj.entities as Array<{ className?: string; offset: number; length: number; url?: string }> | undefined;
      if (entities && Array.isArray(entities) && textContent) {
        const textUrlEntities = entities
          .filter(e => e.className === 'MessageEntityTextUrl' && e.url && typeof e.offset === 'number' && typeof e.length === 'number')
          .sort((a, b) => b.offset - a.offset);

        for (const ent of textUrlEntities) {
          const before = textContent.slice(0, ent.offset);
          const linkLabel = textContent.slice(ent.offset, ent.offset + ent.length);
          const after = textContent.slice(ent.offset + ent.length);
          textContent = `${before}[${linkLabel}](${ent.url})${after}`;
        }
      }

      // Extract poll / quiz questions and options (e.g. Ethiopian trivia quiz from user screenshot)
      if (mediaObj && (mediaObj.className === 'MessageMediaPoll' || mediaObj.poll)) {
        const poll = mediaObj.poll;
        const q = poll?.question?.text || poll?.question || 'Quiz / Poll';
        const answers = (poll?.answers || []).map((a: any) => `• ${a.text?.text || a.text || ''}`).join('\n');
        textContent = `📊 ${q}${answers ? '\n' + answers : ''}${textContent ? '\n\n' + textContent : ''}`;
      }

      // Extract webpage previews
      if (mediaObj && mediaObj.className === 'MessageMediaWebPage' && mediaObj.webpage) {
        const wp = mediaObj.webpage;
        const titleOrDesc = [wp.title, wp.description].filter(Boolean).join('\n');
        if (titleOrDesc && !textContent.includes(titleOrDesc)) {
          textContent = textContent ? `${textContent}\n\n🔗 ${titleOrDesc}` : `🔗 ${titleOrDesc}`;
        }
      }

      // Extract forwarded message attribution (e.g. "Forwarded from Qualitymovbot" from screenshot)
      if (fwdObj) {
        const fwdName = fwdObj.fromName || (fwdObj.channelPost ? 'Channel post' : undefined);
        if (fwdName) {
          textContent = `↪ Forwarded from ${fwdName}\n${textContent}`;
        }
      }

      if (!textContent && !mediaObj) continue;

      const isOut = Boolean(msgObj.out);
      const unixDate = msgObj.date;
      const mDate = unixDate ? new Date(unixDate * 1000).toISOString() : new Date().toISOString();
      const msgId = msgObj.id;

      // Extract sender display name
      const senderObj = msgObj.sender;
      let senderDisplayName = isOut ? 'You' : '';
      if (!isOut) {
        if (senderObj?.firstName) {
          senderDisplayName = `${senderObj.firstName} ${senderObj.lastName || ''}`.trim();
        } else if (senderObj?.title) {
          senderDisplayName = senderObj.title;
        } else {
          senderDisplayName = rawUsername || cleanUsername || 'Channel';
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
          const doc = mediaObj.document;
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
          url: `/api/telegram/media?peerId=${encodeURIComponent(peerId)}&messageId=${msgId}&username=${encodeURIComponent(rawUsername || cleanUsername)}`,
        };
      }

      const newMsg: Message = {
        id: `tg-${cleanRawId || peerId}-${msgId}`,
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

    // Sort chronologically (oldest at top, newest at bottom, just like Telegram)
    synced.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (synced.length > 0) {
      saveRealTelegramMessages(peerId, synced);
      if (cleanRawId) {
        saveRealTelegramMessages(cleanRawId, synced);
        saveRealTelegramMessages(`contact-${cleanRawId}`, synced);
        saveRealTelegramMessages(`channel-${cleanRawId}`, synced);
      }
      if (cleanUsername) {
        saveRealTelegramMessages(cleanUsername, synced);
        saveRealTelegramMessages(`@${cleanUsername}`, synced);
      }
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
export async function getMyTelegramDialogs(customSessionString?: string): Promise<{
  dialogs: TelegramJoinedDialog[];
  notConnected?: boolean;
}> {
  const isDemo = !customSessionString || customSessionString.startsWith('mock_') || customSessionString.startsWith('demo_');

  // If in sandbox mode, provide interactive sample groups and contacts to explore
  if (isDemo) {
    return {
      dialogs: [
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
      ],
      notConnected: false,
    };
  }

  let client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) {
    await new Promise((r) => setTimeout(r, 1200));
    client = await getOrInitTelegramClient(customSessionString);
  }
  if (!client || !client.connected) {
    return { dialogs: [], notConnected: true };
  }

  try {
    const dialogs = await client.getDialogs({ limit: 150 });
    const results: TelegramJoinedDialog[] = [];

    for (const d of dialogs) {
      const entity = d.entity as unknown as {
        id?: { toString: () => string };
        title?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
        megagroup?: boolean;
        broadcast?: boolean;
        className?: string;
      };

      const isChannel = Boolean(d.isChannel) || entity?.className === 'Channel' || Boolean(entity?.broadcast);
      const isGroup = Boolean(d.isGroup) || entity?.className === 'Chat' || Boolean(entity?.megagroup);
      const isUser = Boolean(d.isUser) || entity?.className === 'User';

      if (!isChannel && !isGroup && !isUser) continue;
      if (d.id && d.id.toString() === '777000') continue; // Telegram service notices

      const idStr = d.id ? d.id.toString() : (entity?.id ? entity.id.toString() : '');
      if (!idStr) continue;

      let title = d.title || entity?.title || '';
      if (!title && isUser) {
        title = `${entity?.firstName || ''} ${entity?.lastName || ''}`.trim() || 'Telegram Contact';
      }
      if (!title) {
        title = entity?.username ? `@${entity.username}` : (isUser ? 'Telegram Contact' : 'Telegram Group');
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

    try {
      const contactsRes = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) as any })) as any;
      if (contactsRes && Array.isArray(contactsRes.users)) {
        const seenIds = new Set(results.map(r => r.id.replace(/^-100/, '').replace(/^-/, '')));
        for (const u of contactsRes.users) {
          if (!u || !u.id) continue;
          const uIdStr = u.id.toString();
          if (seenIds.has(uIdStr) || uIdStr === '777000') continue;
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          const title = fullName || (u.username ? `@${u.username}` : (u.phone ? u.phone : 'Telegram Contact'));
          results.push({
            id: uIdStr,
            title,
            username: u.username || undefined,
            isGroup: false,
            isChannel: false,
            isPrivate: !u.username,
            isUser: true,
            unreadCount: 0,
          });
          seenIds.add(uIdStr);
        }
      }
    } catch (cErr) {
      console.warn('Contacts enrichment notice in getMyTelegramDialogs:', cErr);
    }

    return { dialogs: results, notConnected: false };
  } catch (err) {
    console.warn('Telegram getDialogs error:', err);
    return { dialogs: [], notConnected: true };
  }
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

  let client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) {
    await new Promise((r) => setTimeout(r, 1200));
    client = await getOrInitTelegramClient(customSessionString);
  }
  if (!client || !client.connected) {
    return {
      success: false,
      error: 'Not connected to Telegram. Please reconnect your account using the Connect button.',
    };
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
  const now = Date.now();
  if (now - lastUnreadSyncTime < 15000) {
    return; // Throttled to avoid MTProto collision with user actions
  }
  lastUnreadSyncTime = now;

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

export interface TelegramTopicItem {
  id: number;
  title: string;
  iconColor?: number;
  iconEmojiId?: string;
  unreadCount?: number;
  pinned?: boolean;
  closed?: boolean;
  topMessageId?: number;
}

/**
 * Fetch sections / topics for supergroups with forum enabled
 */
export async function getTelegramForumTopics(
  peerId: string,
  peerUsername?: string,
  customSessionString?: string
): Promise<{ isForum: boolean; topics: TelegramTopicItem[] }> {
  const isDemo = !customSessionString || customSessionString.startsWith('mock_') || customSessionString.startsWith('demo_');
  if (isDemo) {
    // Provide realistic topics for demo/testing mode
    return {
      isForum: true,
      topics: [
        { id: 1, title: 'General', pinned: true, unreadCount: 0 },
        { id: 2, title: 'Announcements 📢', pinned: false, unreadCount: 1 },
        { id: 3, title: 'Discussion 💬', pinned: false, unreadCount: 0 },
        { id: 4, title: 'Resources & Links 🔗', pinned: false, unreadCount: 0 },
      ],
    };
  }

  const client = await getOrInitTelegramClient(customSessionString);
  if (!client || !client.connected) {
    return { isForum: false, topics: [] };
  }

  try {
    const cleanRawId = peerId
      .replace(/^channel-/, '')
      .replace(/^contact-/, '')
      .replace(/^-100/, '')
      .replace(/^-/, '')
      .trim()
      .toLowerCase();
    const cleanUsername = (peerUsername || '').replace(/^@/, '').trim().toLowerCase();

    let entity: unknown = null;

    // 1. Username lookup if available
    if (cleanUsername && !cleanUsername.startsWith('user_') && !cleanUsername.startsWith('private_')) {
      try {
        entity = await client.getEntity(cleanUsername);
      } catch {
        // Fall through
      }
    }

    // 2. Dialog search (reliable pre-resolved entity)
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
        console.warn('Dialog search notice in getTelegramForumTopics:', dErr);
      }
    }

    // 3. Fallback numeric ID lookup
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
      return { isForum: false, topics: [] };
    }

    // Query Telegram MTProto for Forum Topics
    try {
      const res = await client.invoke(
        new Api.channels.GetForumTopics({
          channel: entity as any,
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit: 100,
        })
      );

      if (res && 'topics' in res && Array.isArray((res as any).topics)) {
        const topicList = (res as any).topics;
        const mappedTopics: TelegramTopicItem[] = topicList
          .filter((t: any) => t && t.id !== undefined)
          .map((t: any) => ({
            id: Number(t.id),
            title: t.title || (t.id === 1 ? 'General' : `Topic #${t.id}`),
            iconColor: typeof t.iconColor === 'number' ? t.iconColor : undefined,
            iconEmojiId: t.iconEmojiId ? t.iconEmojiId.toString() : undefined,
            unreadCount: typeof t.unreadCount === 'number' ? t.unreadCount : 0,
            pinned: Boolean(t.pinned),
            closed: Boolean(t.closed),
            topMessageId: typeof t.topMessage === 'number' ? t.topMessage : undefined,
          }));

        // Sort: pinned first, then by id
        mappedTopics.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return a.id - b.id;
        });

        return { isForum: true, topics: mappedTopics };
      }
    } catch (forumErr: any) {
      const msg = forumErr?.message || String(forumErr);
      if (
        msg.includes('CHANNEL_FORUM_MISSING') ||
        msg.includes('CHAT_INVALID') ||
        msg.includes('PEER_ID_INVALID') ||
        msg.includes('FORUM_NOT_ALLOWED')
      ) {
        return { isForum: false, topics: [] };
      }
      console.warn('GetForumTopics invoke notice:', forumErr);
    }

    return { isForum: false, topics: [] };
  } catch (err) {
    console.error('Failed to get Telegram forum topics:', err);
    return { isForum: false, topics: [] };
  }
}

