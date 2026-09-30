import { NextResponse } from 'next/server';
import { resetToDemoDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const db = resetToDemoDatabase();
    return NextResponse.json({
      success: true,
      session: db.session,
      message: 'Demo mode activated with sample distraction-free data',
    });
  } catch (error) {
    console.error('Error activating demo mode:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize demo mode' },
      { status: 500 }
    );
  }
}
