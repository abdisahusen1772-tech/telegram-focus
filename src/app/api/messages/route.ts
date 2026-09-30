import { NextRequest, NextResponse } from 'next/server';
import { getPeerMessages, addMessageToPeer, markPeerAsRead, getUserSession, getApprovedContacts } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { Message } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const messages = getPeerMessages(peerId);

    // Intentionally opening conversation resets unread notification status
    markPeerAsRead(peerId);

    return NextResponse.json({
      success: true,
      peerId,
      messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { peerId, text, replyToId, replyToSnippet } = body;

    if (!peerId || !text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'peerId and non-empty text are required' },
        { status: 400 }
      );
    }

    const session = getUserSession();
    const contacts = getApprovedContacts();
    const targetContact = contacts.find(c => c.id === peerId);

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      peerId,
      senderId: session?.userId || 'user-self',
      senderName: session?.firstName || 'You',
      isOutgoing: true,
      text: text.trim(),
      date: new Date().toISOString(),
      replyToId,
      replyToSnippet,
    };

    const saved = addMessageToPeer(newMessage);

    // If connected to real Telegram and targeting a contact with username
    if (session && !session.isDemoMode && targetContact) {
      await sendTelegramMessage(targetContact.username, text.trim());
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
