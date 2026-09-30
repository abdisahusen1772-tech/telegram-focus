import { NextResponse } from 'next/server';
import { clearCachedMessages } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    clearCachedMessages();
    return NextResponse.json({
      success: true,
      message: 'All cached messages and media previews securely cleared from local storage',
    });
  } catch (error) {
    console.error('Error clearing cached messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
