import { NextRequest, NextResponse } from 'next/server';
import { addMessageToPeer, getApprovedContacts, getApprovedChannels } from '@/lib/db';
import { Message } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { peerId } = body;

    const contacts = getApprovedContacts();
    const channels = getApprovedChannels();

    const targetContact = contacts.find(c => c.id === peerId);
    const targetChannel = channels.find(c => c.id === peerId);

    if (!targetContact && !targetChannel) {
      return NextResponse.json(
        { success: false, error: 'Target approved peer not found' },
        { status: 404 }
      );
    }

    if (targetContact) {
      const sampleTexts = [
        'Can you send me the assignment?',
        'Are you available for a brief catch-up later this afternoon?',
        'I reviewed the notes you sent, here is the updated document.',
      ];
      const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];

      const incomingMsg: Message = {
        id: `sim-${Date.now()}`,
        peerId: targetContact.id,
        senderId: targetContact.id,
        senderName: targetContact.firstName,
        isOutgoing: false,
        text: randomText,
        date: new Date().toISOString(),
      };

      addMessageToPeer(incomingMsg);

      return NextResponse.json({
        success: true,
        type: 'contact',
        peerName: targetContact.firstName,
        // STRICT PRIVACY: return notification text with ZERO message content preview!
        notificationText: `New message from ${targetContact.firstName}`,
        message: 'Simulated incoming message triggered',
      });
    }

    if (targetChannel) {
      const incomingPost: Message = {
        id: `sim-post-${Date.now()}`,
        peerId: targetChannel.id,
        senderId: targetChannel.id,
        senderName: targetChannel.title,
        isOutgoing: false,
        text: 'New dispatch: Continuous digital attention fragmentation reduces analytical depth. Cultivate intentional communication spaces.',
        date: new Date().toISOString(),
      };

      addMessageToPeer(incomingPost);

      return NextResponse.json({
        success: true,
        type: 'channel',
        peerName: targetChannel.title,
        notificationText: `New post in ${targetChannel.title}`,
        message: 'Simulated channel post triggered',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown peer' }, { status: 400 });
  } catch (error) {
    console.error('Error simulating incoming message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to simulate incoming message' },
      { status: 500 }
    );
  }
}
