import { NextResponse } from 'next/server';
import { setUserSession } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    setUserSession(null);
    const response = NextResponse.json({
      success: true,
      message: 'Telegram account disconnected securely',
    });
    response.cookies.delete('tg_focus_session');
    return response;
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}
