export interface UserSession {
  userId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone: string;
  sessionString: string;
  isConnected: boolean;
  isDemoMode?: boolean;
  connectedAt: string;
  lastSyncedAt: string;
}

export interface ApprovedContact {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  status: 'new_message' | 'no_new_message'; // 🔵 vs ⚪
  unreadCount: number;
  notificationsEnabled: boolean;
  addedAt: string;
  lastMessageAt: string;
}

export interface ApprovedChannel {
  id: string;
  username: string;
  title: string;
  about?: string;
  avatarUrl?: string;
  notificationsEnabled: boolean;
  addedAt: string;
  lastPostAt: string;
  hasNewPost: boolean;
}

export interface MessageMedia {
  type: 'image' | 'video' | 'voice' | 'document';
  url: string;
  name?: string;
  duration?: number;
  size?: string;
}

export interface Message {
  id: string;
  peerId: string; // contactId or channelId
  peerUsername?: string;
  senderId: string;
  senderName: string;
  isOutgoing: boolean;
  text: string;
  date: string; // ISO string
  media?: MessageMedia;
  replyToId?: string;
  replyToSnippet?: string;
}

export interface AppSettings {
  focusMode: boolean;
  messagePreviewAlwaysOff: true; // Permanent anti-distraction guarantee
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  highContrastEInk: boolean;
  theme?: 'paper' | 'eink' | 'obsidian' | 'midnight' | 'sage' | 'nordic';
  channelNotifications: Record<string, boolean>;
  contactNotifications: Record<string, boolean>;
}

export interface DatabaseSchema {
  session: UserSession | null;
  contacts: ApprovedContact[];
  channels: ApprovedChannel[];
  messages: Message[];
  settings: AppSettings;
  apiCredentials?: {
    apiId: string;
    apiHash: string;
  };
}
