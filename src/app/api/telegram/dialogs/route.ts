import { NextResponse } from 'next/server';
import { getMyTelegramDialogs } from '@/lib/telegram';
import { getApprovedChannels } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dialogs = await getMyTelegramDialogs();
    const approvedChannels = getApprovedChannels();
    const approvedIds = new Set(approvedChannels.map(c => c.id.replace(/^channel-/, '')));

    const enriched = dialogs.map(d => ({
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
