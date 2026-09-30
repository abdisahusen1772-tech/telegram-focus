import { NextResponse } from 'next/server';
import { setUserSession } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    setUserSession(null);
    return NextResponse.json({
      success: true,
      message: 'Telegram account disconnected securely',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}
