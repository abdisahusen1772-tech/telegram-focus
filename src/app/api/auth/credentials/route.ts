import { NextRequest, NextResponse } from 'next/server';
import { getApiCredentials, setApiCredentials } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const creds = getApiCredentials();
    return NextResponse.json({
      success: true,
      credentials: creds,
      isConfigured: Boolean(creds?.apiId && creds?.apiHash),
    });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve API credentials' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiId, apiHash } = body;

    if (!apiId || !apiHash || typeof apiId !== 'string' || typeof apiHash !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Both API ID and API Hash are required' },
        { status: 400 }
      );
    }

    const cleanId = apiId.trim();
    const cleanHash = apiHash.trim();

    // 1. Save in database
    setApiCredentials(cleanId, cleanHash);

    // 2. Persist in .env.local as well
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      const envContent = `TELEGRAM_API_ID=${cleanId}\nTELEGRAM_API_HASH=${cleanHash}\nSESSION_SECRET=distraction_free_local_secret_key\n`;
      fs.writeFileSync(envPath, envContent, 'utf-8');
      process.env.TELEGRAM_API_ID = cleanId;
      process.env.TELEGRAM_API_HASH = cleanHash;
    } catch (envErr) {
      console.warn('Could not write to .env.local:', envErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram API credentials successfully saved and activated',
      credentials: { apiId: cleanId, apiHash: cleanHash },
    });
  } catch (error) {
    console.error('Error saving credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save credentials' },
      { status: 500 }
    );
  }
}
