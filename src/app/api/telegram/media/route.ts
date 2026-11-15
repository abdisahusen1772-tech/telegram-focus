import { NextRequest, NextResponse } from 'next/server';
import { getOrInitTelegramClient } from '@/lib/telegram';
import { resolveSession } from '@/lib/session-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get('peerId');
    const messageId = searchParams.get('messageId');

    if (!peerId || !messageId) {
      return new NextResponse('Missing peerId or messageId', { status: 400 });
    }

    const session = resolveSession(req);
    const client = await getOrInitTelegramClient(session?.sessionString);
    if (!client || !client.connected) {
      return new NextResponse('Not connected to Telegram', { status: 401 });
    }

    const cleanUsername = peerId.replace(/^contact-/, '').replace(/^channel-/, '').replace(/^@/, '');
    const rawId = peerId.replace(/^contact-/, '').replace(/^channel-/, '');

    // Resolve entity via dialogs (has inputEntity with accessHash)
    let entity: unknown = null;
    try {
      const dialogs = await client.getDialogs({ limit: 120 });
      const matched = dialogs.find((d) => {
        const dId = d.id ? d.id.toString() : '';
        const dEntity = d.entity as { username?: string } | undefined;
        return (
          dId === rawId ||
          dId === peerId ||
          (cleanUsername && !cleanUsername.startsWith('user_') && dEntity?.username?.toLowerCase() === cleanUsername.toLowerCase())
        );
      });
      if (matched) {
        entity = matched.inputEntity || matched.entity;
      }
    } catch {
      // ignore
    }

    if (!entity) {
      try {
        entity = await client.getEntity(cleanUsername);
      } catch {
        try {
          entity = await client.getEntity(rawId);
        } catch {}
      }
    }

    if (!entity) {
      return new NextResponse('Peer not found', { status: 404 });
    }

    const msgIdNum = parseInt(messageId, 10);
    const messages = await client.getMessages(entity as any, { ids: [msgIdNum] });
    const targetMsg = messages[0];

    if (!targetMsg || !targetMsg.media) {
      return new NextResponse('Media not found on message', { status: 404 });
    }

    // Download media buffer from Telegram MTProto
    const buffer = await client.downloadMedia(targetMsg, {});

    if (!buffer || (Buffer.isBuffer(buffer) && buffer.length === 0)) {
      return new NextResponse('Could not download media', { status: 502 });
    }

    let contentType = 'image/jpeg';
    const media = targetMsg.media as any;
    if (media.document) {
      contentType = media.document.mimeType || 'application/octet-stream';
    } else if (media.className === 'MessageMediaPhoto') {
      contentType = 'image/jpeg';
    }

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch (err: unknown) {
    console.error('Error serving Telegram media:', err);
    return new NextResponse('Internal error downloading media', { status: 500 });
  }
}
