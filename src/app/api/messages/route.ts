import { NextRequest, NextResponse } from 'next/server';
import { getPeerMessages, addMessageToPeer, markPeerAsRead, getUserSession, getApprovedContacts, getApprovedChannels } from '@/lib/db';
import { sendTelegramMessage, syncMessagesFromTelegram } from '@/lib/telegram';
import { Message } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get('peerId');

    if (!peerId) {
      return NextResponse.json(
        { success: false, error: 'peerId query parameter is required' },
        { status: 400 }
      );
    }

    const session = getUserSession();
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
      ch.id.toLowerCase() === `channel-${cleanId}`
    );

    // 1. Immediately retrieve locally cached messages for instant rendering
    let messages = getPeerMessages(peerId);

    // 2. If connected to real Telegram, attempt live sync with 6.5s timeout
    if (session && !session.isDemoMode && session.isConnected && session.sessionString && (targetContact || targetChannel)) {
      try {
        const syncId = targetContact?.id || targetChannel?.id || peerId;
        const syncUser = targetContact?.username || targetChannel?.username || '';
        const syncPromise = syncMessagesFromTelegram(syncId, syncUser);
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6500));
        await Promise.race([syncPromise, timeoutPromise]);
        // Refresh messages in case new ones were saved
        messages = getPeerMessages(peerId);
      } catch (syncErr) {
        console.warn('Real-time Telegram sync warning (continuing with cached messages):', syncErr);
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
    const { peerId, text, replyToId, replyToSnippet, media } = body;

    const hasText = Boolean(text && typeof text === 'string' && text.trim() !== '');
    const hasMedia = Boolean(media && typeof media === 'object' && media.url);

    if (!peerId || (!hasText && !hasMedia)) {
      return NextResponse.json(
        { success: false, error: 'peerId and either text or media attachment are required' },
        { status: 400 }
      );
    }

    const session = getUserSession();
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
    };

    const saved = addMessageToPeer(newMessage);

    // If connected to real Telegram, dispatch to recipient contact or group
    const targetIdentifier = targetContact?.username || targetChannel?.username;
    if (session && !session.isDemoMode && targetIdentifier) {
      await sendTelegramMessage(targetIdentifier, (text || '').trim(), hasMedia ? media : undefined);
    }

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
