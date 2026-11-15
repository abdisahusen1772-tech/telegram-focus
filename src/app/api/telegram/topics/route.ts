import { NextRequest, NextResponse } from 'next/server';
import { getTelegramForumTopics } from '@/lib/telegram';
import { resolveSession } from '@/lib/session-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get('peerId');
    const username = searchParams.get('username') || undefined;

    if (!peerId) {
      return NextResponse.json(
        { success: false, error: 'peerId parameter is required' },
        { status: 400 }
      );
    }

    const session = resolveSession(req);
    const sessionString = session?.sessionString;

    const result = await getTelegramForumTopics(peerId, username, sessionString);

    return NextResponse.json({
      success: true,
      peerId,
      isForum: result.isForum,
      topics: result.topics,
    });
  } catch (err: unknown) {
    console.error('Error fetching forum topics:', err);
    return NextResponse.json(
      { success: false, isForum: false, topics: [], error: 'Failed to retrieve forum topics' },
      { status: 500 }
    );
  }
}
