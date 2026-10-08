import { NextRequest, NextResponse } from 'next/server';
import { getApprovedChannels, addApprovedChannel, removeApprovedChannel, updateChannelNotifications, togglePinChannel } from '@/lib/db';
import { verifyTelegramUsername } from '@/lib/telegram';
import { ApprovedChannel } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const channels = getApprovedChannels();
    return NextResponse.json({
      success: true,
      channels,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve approved channels' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, id, title, isGroup, isPrivate } = body;

    // Direct addition of private joined channel or group from user's Telegram
    if (id && title) {
      const cleanId = String(id).replace(/^-100/, '').replace(/^-/, '');
      const newChannel: ApprovedChannel = {
        id: `channel-${cleanId}`,
        username: username || `private_${cleanId}`,
        title: isGroup ? `👥 ${title}` : `🔒 ${title}`,
        about: isGroup ? 'Private Telegram Group' : 'Private Telegram Channel',
        notificationsEnabled: true,
        addedAt: new Date().toISOString(),
        lastPostAt: new Date().toISOString(),
        hasNewPost: false,
        isGroup: Boolean(isGroup),
        isPrivate: true,
      };

      const saved = addApprovedChannel(newChannel);
      return NextResponse.json({
        success: true,
        channel: saved,
        message: `Added private ${isGroup ? 'group' : 'channel'} "${title}" to Allowed list`,
      });
    }

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Telegram channel username or private group details required' },
        { status: 400 }
      );
    }

    const verification = await verifyTelegramUsername(username);

    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Channel could not be verified on Telegram' },
        { status: 404 }
      );
    }

    if (verification.entityType === 'contact') {
      return NextResponse.json(
        {
          success: false,
          error: `@${username} is an individual contact, not a broadcast channel. Please add it under Allowed Contacts.`,
        },
        { status: 400 }
      );
    }

    const newChannel = verification.channel!;
    const saved = addApprovedChannel(newChannel);

    return NextResponse.json({
      success: true,
      channel: saved,
      message: `Verified and added channel @${saved.username} to Approved Channels`,
    });
  } catch (error) {
    console.error('Error adding approved channel:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add approved channel' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, notificationsEnabled, action } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    if (action === 'toggle_pin') {
      const isPinned = togglePinChannel(id);
      return NextResponse.json({
        success: true,
        isPinned,
        message: `Channel ${isPinned ? 'pinned to top' : 'unpinned'}`,
      });
    }

    if (typeof notificationsEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'notificationsEnabled boolean or action required' },
        { status: 400 }
      );
    }

    updateChannelNotifications(id, notificationsEnabled);
    return NextResponse.json({
      success: true,
      message: `Channel notifications ${notificationsEnabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('Error updating channel notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update channel' },
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
        { success: false, error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    const removed = removeApprovedChannel(id);
    return NextResponse.json({
      success: removed,
      message: 'Channel removed from approved list',
    });
  } catch (error) {
    console.error('Error removing channel:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove channel' },
      { status: 500 }
    );
  }
}
