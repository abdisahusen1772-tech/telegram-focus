import { NextResponse } from 'next/server';
import { getUserSession, getAppSettings, getApiCredentials } from '@/lib/db';
import { isTelegramApiConfigured } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = getUserSession();
    const settings = getAppSettings();
    const isApiConfigured = isTelegramApiConfigured();

    const creds = getApiCredentials();

    return NextResponse.json({
      success: true,
      session,
      settings,
      isApiConfigured: Boolean(creds?.apiId && creds?.apiHash),
      credentials: creds,
      apiIdPresent: Boolean(creds?.apiId),
    });
  } catch (error) {
    console.error('Error fetching auth status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve auth status' },
      { status: 500 }
    );
  }
}
