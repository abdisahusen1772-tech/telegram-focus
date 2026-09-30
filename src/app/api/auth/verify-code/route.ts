import { NextRequest, NextResponse } from 'next/server';
import { signInWithTelegramCode } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, phoneCode, phoneCodeHash, password } = body;

    if (!phoneNumber || !phoneCode || !phoneCodeHash) {
      return NextResponse.json(
        { success: false, error: 'Phone number, code, and phone code hash are required' },
        { status: 400 }
      );
    }

    const result = await signInWithTelegramCode({
      phoneNumber,
      phoneCode: phoneCode.trim(),
      phoneCodeHash,
      password: password ? password.trim() : undefined,
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

    return NextResponse.json({
      success: true,
      user: result.user,
      message: 'Successfully connected Telegram account',
    });
  } catch (error) {
    console.error('Error in verify-code route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to authenticate verification code' },
      { status: 500 }
    );
  }
}
