import { NextResponse } from 'next/server';
import { getUserSession, getAppSettings } from '@/lib/db';
import { isTelegramApiConfigured } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = getUserSession();
    const settings = getAppSettings();
    const isApiConfigured = isTelegramApiConfigured();

    return NextResponse.json({
      success: true,
      session,
      settings,
      isApiConfigured,
      apiIdPresent: Boolean(process.env.TELEGRAM_API_ID),
    });
  } catch (error) {
    console.error('Error fetching auth status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve auth status' },
      { status: 500 }
    );
  }
}
