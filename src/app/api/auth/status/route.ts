import { NextRequest, NextResponse } from 'next/server';
import { getUserSession, setUserSession, getAppSettings, getApiCredentials } from '@/lib/db';
import { isTelegramApiConfigured } from '@/lib/telegram';
import { UserSession } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let session = getUserSession();

    // Check cookie fallback if serverless container started without disk session
    if (!session) {
      const cookieVal = req.cookies.get('tg_focus_session')?.value;
      if (cookieVal) {
        try {
          const parsed = JSON.parse(Buffer.from(cookieVal, 'base64').toString('utf-8')) as UserSession;
          if (parsed && parsed.sessionString) {
            setUserSession(parsed);
            session = parsed;
          }
        } catch (e) {
          console.warn('Could not restore session from cookie:', e);
        }
      }
    }

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
