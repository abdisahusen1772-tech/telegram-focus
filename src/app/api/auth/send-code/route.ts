import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramVerificationCode } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, apiId, apiHash } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const result = await sendTelegramVerificationCode(phoneNumber, apiId, apiHash);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send verification code' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      intermediateSession: result.intermediateSession,
      isRegistered: result.isRegistered,
      isMock: result.isMock,
      message: result.isMock
        ? 'Test mode: Use verification code 12345 (or any 5-digit code) to test'
        : 'Official Telegram verification code sent to your Telegram app / SMS',
    });

    if (result.intermediateSession) {
      response.cookies.set('tg_auth_temp_session', result.intermediateSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15, // 15 minutes
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Error in send-code route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while sending code' },
      { status: 500 }
    );
  }
}
