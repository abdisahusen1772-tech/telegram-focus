import { NextRequest, NextResponse } from 'next/server';
import { getMyTelegramDialogs } from '@/lib/telegram';
import { getApprovedChannels, getApprovedContacts } from '@/lib/db';
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

    const { dialogs, notConnected } = await getMyTelegramDialogs(session.sessionString);
    if (notConnected) {
      return NextResponse.json({
        success: true,
        notConnected: true,
        error: 'Telegram account not connected or session expired. Please connect your Telegram account first.',
        dialogs: [],
      });
    }

    const approvedChannels = getApprovedChannels();
    const approvedContacts = getApprovedContacts();
    const approvedChannelIds = new Set(
      approvedChannels.map((c) =>
        c.id.replace(/^channel-/, '').replace(/^-100/, '').replace(/^-/, '')
      )
    );
    const approvedContactIds = new Set(
      approvedContacts.map((c) =>
        c.id.replace(/^contact-/, '').replace(/^-/, '')
      )
    );

    const enriched = dialogs.map((d) => {
      const rawId = d.id.replace(/^-100/, '').replace(/^-/, '');
      const isAlreadyAdded = d.isUser
        ? approvedContactIds.has(rawId)
        : approvedChannelIds.has(rawId);
      return {
        ...d,
        isAlreadyAdded,
      };
    });

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
