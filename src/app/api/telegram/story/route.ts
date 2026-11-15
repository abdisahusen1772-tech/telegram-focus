import { NextRequest, NextResponse } from 'next/server';
import { postTelegramStory } from '@/lib/telegram';
import { resolveSession } from '@/lib/session-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = resolveSession(req);
    if (!session || !session.isConnected || !session.sessionString) {
      return NextResponse.json(
        { success: false, error: 'Please connect your Telegram account first to post stories' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { media, caption } = body;

    if (!media || typeof media !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please select a photo to post to your Story' },
        { status: 400 }
      );
    }

    const result = await postTelegramStory({
      mediaDataUrl: media,
      caption: typeof caption === 'string' ? caption : undefined,
      customSessionString: session.sessionString,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to post story' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Story posted to your Telegram profile successfully!',
    });
  } catch (error: unknown) {
    console.error('Error in story route:', error);
    const msg = error instanceof Error ? error.message : 'Internal error posting story';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
