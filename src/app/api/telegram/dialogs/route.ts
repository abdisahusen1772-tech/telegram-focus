import { NextRequest, NextResponse } from 'next/server';
import { getMyTelegramDialogs } from '@/lib/telegram';
import { getApprovedChannels } from '@/lib/db';
import { resolveSession } from '@/lib/session-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const session = resolveSession(req);
    if (!session || !session.isConnected || !session.sessionString) {
      return NextResponse.json({
        success: true,
        notConnected: true,
        error: 'Telegram account not connected or session expired. Please connect your Telegram account first.',
        dialogs: [],
      });
    }

    const dialogs = await getMyTelegramDialogs(session.sessionString);
    const approvedChannels = getApprovedChannels();
    const approvedIds = new Set(
      approvedChannels.map((c) =>
        c.id.replace(/^channel-/, '').replace(/^-100/, '').replace(/^-/, '')
      )
    );

    const enriched = dialogs.map((d) => ({
      ...d,
      isAlreadyAdded: approvedIds.has(d.id.replace(/^-100/, '').replace(/^-/, '')),
    }));

    return NextResponse.json({
      success: true,
      dialogs: enriched,
    });
  } catch (error) {
    console.error('Error fetching Telegram dialogs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve joined dialogs' },
      { status: 500 }
    );
  }
}
