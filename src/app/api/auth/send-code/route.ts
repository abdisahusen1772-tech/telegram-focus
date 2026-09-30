import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramVerificationCode } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const result = await sendTelegramVerificationCode(phoneNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      isRegistered: result.isRegistered,
      isMock: result.isMock,
      message: result.isMock
        ? 'Test mode: Use verification code 12345 (or any 5-digit code) to test'
        : 'Official Telegram verification code sent to your Telegram app / SMS',
    });
  } catch (error) {
    console.error('Error in send-code route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while sending code' },
      { status: 500 }
    );
  }
}
