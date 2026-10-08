import { NextRequest, NextResponse } from 'next/server';
import { signInWithTelegramCode } from '@/lib/telegram';
import { getUserSession } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, phoneCode, phoneCodeHash, password, intermediateSession } = body;

    if (!phoneNumber || !phoneCode || !phoneCodeHash) {
      return NextResponse.json(
        { success: false, error: 'Phone number, code, and phone code hash are required' },
        { status: 400 }
      );
    }

    const sessionToUse = intermediateSession || req.cookies.get('tg_auth_temp_session')?.value;

    const result = await signInWithTelegramCode({
      phoneNumber,
      phoneCode: phoneCode.trim(),
      phoneCodeHash,
      password: password ? password.trim() : undefined,
      intermediateSession: sessionToUse,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          needs2FA: result.needs2FA,
          error: result.error || 'Authentication failed',
        },
        { status: result.needs2FA ? 403 : 400 }
      );
    }

    const session = getUserSession();
    const response = NextResponse.json({
      success: true,
      session,
      user: result.user,
      message: 'Successfully connected Telegram account',
    });

    if (session) {
      try {
        const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
        response.cookies.set('tg_focus_session', sessionB64, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
        });
      } catch (e) {
        console.warn('Cookie set error:', e);
      }
    }

    return response;
  } catch (error) {
    console.error('Error in verify-code route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to authenticate verification code' },
      { status: 500 }
    );
  }
}
