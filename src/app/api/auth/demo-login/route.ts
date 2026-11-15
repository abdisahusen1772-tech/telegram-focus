import { NextResponse } from 'next/server';
import { resetToDemoDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const db = resetToDemoDatabase();
    const response = NextResponse.json({
      success: true,
      session: db.session,
      message: 'Demo mode activated with sample distraction-free data',
    });

    if (db.session) {
      try {
        const sessionB64 = Buffer.from(JSON.stringify(db.session)).toString('base64');
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
    console.error('Error activating demo mode:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize demo mode' },
      { status: 500 }
    );
  }
}
