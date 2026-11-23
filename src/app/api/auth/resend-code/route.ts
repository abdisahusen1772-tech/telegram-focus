import { NextRequest, NextResponse } from 'next/server';
import { resendTelegramVerificationCode } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, phoneCodeHash, intermediateSession, apiId, apiHash } = body;

    if (!phoneNumber || !phoneCodeHash) {
      return NextResponse.json(
        { success: false, error: 'Phone number and phone code hash are required' },
        { status: 400 }
      );
    }

    const sessionToUse = intermediateSession || req.cookies.get('tg_auth_temp_session')?.value;
    const effectiveApiId = apiId || req.headers.get('x-telegram-api-id') || undefined;
    const effectiveApiHash = apiHash || req.headers.get('x-telegram-api-hash') || undefined;

    const result = await resendTelegramVerificationCode({
      phoneNumber,
      phoneCodeHash,
      intermediateSession: sessionToUse,
      apiId: effectiveApiId,
      apiHash: effectiveApiHash,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to resend verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp,
      message: result.isCodeViaApp
        ? 'Code resent to your Telegram app. Please check the "Telegram" chat!'
        : 'Code resent via SMS to your phone!',
    });
  } catch (error: unknown) {
    console.error('Error in resend-code route:', error);
    const msg = error instanceof Error ? error.message : 'Failed to resend code';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
