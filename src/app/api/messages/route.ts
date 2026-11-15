import { NextRequest, NextResponse } from 'next/server';
import { getPeerMessages, addMessageToPeer, markPeerAsRead, getApprovedContacts, getApprovedChannels, addApprovedChannel } from '@/lib/db';
import { sendTelegramMessage, syncMessagesFromTelegram } from '@/lib/telegram';
import { Message, ApprovedChannel } from '@/lib/types';
import { resolveSession } from '@/lib/session-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get('peerId');
    const queryUsername = (searchParams.get('username') || '').replace(/^@/, '').trim();
    const queryTitle = (searchParams.get('title') || '').trim();
    const topicIdParam = searchParams.get('topicId');
    const topicId = topicIdParam ? parseInt(topicIdParam, 10) : undefined;

    if (!peerId) {
      return NextResponse.json(
        { success: false, error: 'peerId query parameter is required' },
        { status: 400 }
      );
    }

    const session = resolveSession(req);
    const contacts = getApprovedContacts();
    const channels = getApprovedChannels();
    const cleanId = peerId.toLowerCase().replace(/^@/, '');
    const targetContact = contacts.find(c =>
      c.id === peerId ||
      c.username.toLowerCase() === cleanId ||
      c.id.toLowerCase() === `contact-${cleanId}`
    );
    const targetChannel = channels.find(ch =>
      ch.id === peerId ||
      ch.username.toLowerCase() === cleanId ||
      ch.id.toLowerCase() === `channel-${cleanId}` ||
      (queryUsername && ch.username.toLowerCase() === queryUsername.toLowerCase())
    );

    // If client supplied channel details and it's missing in this lambda's local memory, register it
    if (!targetChannel && !targetContact && queryUsername) {
      const autoChannel: ApprovedChannel = {
        id: peerId,
        username: queryUsername,
        title: queryTitle || queryUsername,
        about: `@${queryUsername}`,
        notificationsEnabled: true,
        addedAt: new Date().toISOString(),
        lastPostAt: new Date().toISOString(),
        hasNewPost: false,
        isGroup: false,
        isPrivate: false,
      };
      addApprovedChannel(autoChannel);
    }

    // 1. Immediately retrieve locally cached messages for instant rendering
    let messages = getPeerMessages(peerId);

    // 2. If connected to real Telegram, live sync with 20s timeout
    const syncUser = queryUsername || targetContact?.username || targetChannel?.username || '';
    const syncId = targetContact?.id || targetChannel?.id || peerId;

    if (session && !session.isDemoMode && session.isConnected && session.sessionString) {
      try {
        const syncPromise = syncMessagesFromTelegram(syncId, syncUser, session.sessionString, topicId);
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 20000));
        const syncedMessages = (await Promise.race([syncPromise, timeoutPromise])) as Message[];
        if (Array.isArray(syncedMessages) && syncedMessages.length > 0) {
          messages = syncedMessages;
        } else if (messages.length === 0) {
          messages = getPeerMessages(peerId);
        }
      } catch (syncErr) {
        console.warn('Real-time Telegram sync warning (continuing with cached messages):', syncErr);
        if (messages.length === 0) {
          messages = getPeerMessages(peerId);
        }
      }
    }

    // Intentionally opening conversation resets unread notification status
    try {
      markPeerAsRead(peerId);
    } catch (readErr) {
      console.warn('markPeerAsRead notice:', readErr);
    }

    return NextResponse.json({
      success: true,
      peerId,
      messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    try {
      const { searchParams } = new URL(req.url);
      const peerId = searchParams.get('peerId');
      if (peerId) {
        const fallbackMessages = getPeerMessages(peerId);
        return NextResponse.json({
          success: true,
          peerId,
          messages: fallbackMessages,
        });
      }
    } catch {
      // ignore
    }
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { peerId, text, replyToId, replyToSnippet, media, topicId } = body;

    const hasText = Boolean(text && typeof text === 'string' && text.trim() !== '');
    const hasMedia = Boolean(media && typeof media === 'object' && media.url);

    if (!peerId || (!hasText && !hasMedia)) {
      return NextResponse.json(
        { success: false, error: 'peerId and either text or media attachment are required' },
        { status: 400 }
      );
    }

    const session = resolveSession(req);
    const contacts = getApprovedContacts();
    const targetContact = contacts.find(c => c.id === peerId);
    const channels = getApprovedChannels();
    const targetChannel = channels.find(ch => ch.id === peerId);

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      peerId,
      senderId: session?.userId || 'user-self',
      senderName: session?.firstName || 'You',
      isOutgoing: true,
      text: (text || '').trim(),
      date: new Date().toISOString(),
      media: hasMedia ? media : undefined,
      replyToId,
      replyToSnippet,
      topicId: topicId ? Number(topicId) : undefined,
    };

    // If connected to real Telegram, dispatch to recipient contact, channel, or group
    const targetIdentifier = targetContact?.username || targetContact?.id || targetChannel?.username || targetChannel?.id;
    if (session && !session.isDemoMode && targetIdentifier && session.sessionString) {
      try {
        const sent = await sendTelegramMessage(
          targetIdentifier,
          (text || '').trim(),
          hasMedia ? media : undefined,
          session.sessionString,
          topicId ? Number(topicId) : undefined
        );
        if (!sent) {
          throw new Error('Telegram server did not confirm dispatch');
        }
      } catch (tgSendErr: unknown) {
        console.error('Failed to dispatch telegram message:', tgSendErr);
        const errMsg = tgSendErr instanceof Error ? tgSendErr.message : String(tgSendErr);
        if (errMsg.includes('CHAT_WRITE_FORBIDDEN') || errMsg.includes('CHAT_ADMIN_REQUIRED')) {
          return NextResponse.json(
            { success: false, error: 'You do not have permission to post in this channel on Telegram (Channel Admin or Owner permissions required).' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { success: false, error: `Telegram delivery error: ${errMsg || 'Could not send message'}` },
          { status: 500 }
        );
      }
    }

    const saved = addMessageToPeer(newMessage);

    return NextResponse.json({
      success: true,
      message: saved,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
