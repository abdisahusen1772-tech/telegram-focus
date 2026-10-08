import { NextRequest, NextResponse } from 'next/server';
import { getApprovedContacts, addApprovedContact, removeApprovedContact, togglePinContact } from '@/lib/db';
import { verifyTelegramUsername, syncContactUnreadStatusFromTelegram } from '@/lib/telegram';
import { resolveSession } from '@/lib/session-helper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const session = resolveSession(req);
    if (session && !session.isDemoMode && session.isConnected && session.sessionString) {
      try {
        const syncPromise = syncContactUnreadStatusFromTelegram(session.sessionString);
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6500));
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (syncErr) {
        console.warn('Real contact unread sync warning:', syncErr);
      }
    }

    const contacts = getApprovedContacts();
    return NextResponse.json({
      success: true,
      contacts,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve approved contacts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Telegram username is required (e.g. @username)' },
        { status: 400 }
      );
    }

    const verification = await verifyTelegramUsername(username);

    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Username could not be verified on Telegram' },
        { status: 404 }
      );
    }

    if (verification.entityType === 'channel') {
      return NextResponse.json(
        {
          success: false,
          error: `@${username} is a Telegram Channel, not a user contact. Please add it under Allowed Channels.`,
        },
        { status: 400 }
      );
    }

    const newContact = verification.contact!;
    const saved = addApprovedContact(newContact);

    return NextResponse.json({
      success: true,
      contact: saved,
      message: `Verified and added @${saved.username} to Approved Contacts`,
    });
  } catch (error) {
    console.error('Error adding approved contact:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add approved contact' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    const removed = removeApprovedContact(id);
    return NextResponse.json({
      success: removed,
      message: 'Contact removed from approved list',
    });
  } catch (error) {
    console.error('Error removing contact:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove contact' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    if (action === 'toggle_pin') {
      const isPinned = togglePinContact(id);
      return NextResponse.json({
        success: true,
        isPinned,
        message: `Contact ${isPinned ? 'pinned to top' : 'unpinned'}`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}
