'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Radio,
  ShieldCheck,
  Clock,
  Send,
  Users,
  Lock,
  FileText,
  Download,
  X,
  Paperclip,
  Camera,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Hash,
  Pin,
  CornerDownRight,
  MessageSquare,
  Layers,
  Sparkles,
  Share2,
  Smile,
  Timer,
  Calendar,
  BarChart3,
  Reply,
} from 'lucide-react';
import { ApprovedChannel, ApprovedContact, Message, MessagePoll } from '@/lib/types';
import { FormattedMessageText } from '@/components/FormattedMessageText';
import { ForwardModal } from '@/components/ForwardModal';
import { PollModal } from '@/components/PollModal';

interface ChannelViewProps {
  channel: ApprovedChannel;
  onBack: () => void;
  onNotificationToggled?: (enabled: boolean) => void;
  onRemoveChannel?: (id: string) => void;
  allContacts?: ApprovedContact[];
  allChannels?: ApprovedChannel[];
}

interface ForumTopic {
  id: number;
  title: string;
  iconColor?: number;
  iconEmojiId?: string;
  unreadCount?: number;
  pinned?: boolean;
  closed?: boolean;
  topMessageId?: number;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '👏', '🚀', '🎉'];
const TTL_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '10s', seconds: 10 },
  { label: '1m', seconds: 60 },
  { label: '1h', seconds: 3600 },
  { label: '24h', seconds: 86400 },
];

export function ChannelView({
  channel,
  onBack,
  onNotificationToggled,
  onRemoveChannel,
  allContacts = [],
  allChannels = [],
}: ChannelViewProps) {
  const [posts, setPosts] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(channel.notificationsEnabled);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [isForum, setIsForum] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Advanced features state
  const [isSilent, setIsSilent] = useState(false);
  const [ttlSeconds, setTtlSeconds] = useState(0);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showTtlMenu, setShowTtlMenu] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'document';
    name: string;
    size?: string;
    url: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Restore draft on channel open or topic switch
  const draftKey = `draft_ch_${channel.id}_${activeTopicId || 'main'}`;
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const draft = localStorage.getItem(draftKey);
      setInputText(draft || '');
    }
  }, [channel.id, activeTopicId]);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (typeof window !== 'undefined') {
      if (val.trim()) {
        localStorage.setItem(draftKey, val);
      } else {
        localStorage.removeItem(draftKey);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedMedia({
        type: isImage ? 'image' : 'document',
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        url: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('tg_focus_session');
    if (token) headers['x-telegram-session'] = token;
    const savedUser = localStorage.getItem('tg_focus_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.userId) headers['x-telegram-user-id'] = u.userId;
        if (u.firstName) headers['x-telegram-first-name'] = encodeURIComponent(u.firstName);
        if (u.phone) headers['x-telegram-phone'] = u.phone;
        if (u.username) headers['x-telegram-username'] = u.username;
      } catch {}
    }
    const savedChannels = localStorage.getItem('tg_focus_channels');
    if (savedChannels) {
      try {
        const parsed = JSON.parse(savedChannels);
        if (Array.isArray(parsed) && parsed.length > 0) {
          headers['x-telegram-channels'] = encodeURIComponent(savedChannels);
        }
      } catch {}
    }
    const savedContacts = localStorage.getItem('tg_focus_contacts');
    if (savedContacts) {
      try {
        const parsed = JSON.parse(savedContacts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          headers['x-telegram-contacts'] = encodeURIComponent(savedContacts);
        }
      } catch {}
    }
    return headers;
  };

  const fetchForumTopics = async () => {
    setLoadingTopics(true);
    try {
      const params = new URLSearchParams({
        peerId: channel.id,
        username: channel.username || '',
      });
      const res = await fetch(`/api/telegram/topics?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.topics) && data.topics.length > 0) {
        setIsForum(true);
        setTopics(data.topics);
      } else {
        setIsForum(Boolean(data.isForum));
      }
    } catch (e) {
      console.warn('Could not fetch forum topics:', e);
    } finally {
      setLoadingTopics(false);
    }
  };

  const fetchChannelPosts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const params = new URLSearchParams({
        peerId: channel.id,
        username: channel.username || '',
        title: channel.title || '',
      });
      if (activeTopicId !== null) {
        params.append('topicId', activeTopicId.toString());
      }

      const res = await fetch(`/api/messages?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setPosts(data.messages);
      }
    } catch (e) {
      console.error('Error fetching channel posts:', e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, pollData?: MessagePoll) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if ((!text && !selectedMedia && !pollData) || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          peerId: channel.id,
          text: pollData ? `📊 ${pollData.question}` : text,
          media: selectedMedia || undefined,
          topicId: activeTopicId || undefined,
          replyToId: replyTo?.id,
          replyToSnippet: replyTo ? `${replyTo.senderName}: ${replyTo.text.slice(0, 45)}...` : undefined,
          silent: isSilent,
          expiresInSeconds: ttlSeconds > 0 ? ttlSeconds : undefined,
          scheduledFor: scheduledTime || undefined,
          poll: pollData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInputText('');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(draftKey);
        }
        setSelectedMedia(null);
        setReplyTo(null);
        setScheduledTime('');
        setShowAttachmentMenu(false);
        setShowTtlMenu(false);
        setShowScheduleMenu(false);
        setPosts((prev) => [...prev, data.message]);
      } else {
        alert(data.error || 'Failed to post: Administrator or Owner privileges are required to post to this channel or topic.');
      }
    } catch (err) {
      console.error('Failed to send channel message:', err);
      alert('Failed to send message to Telegram.');
    } finally {
      setSending(false);
    }
  };

  // Reactions
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveReactionMsgId(null);
    try {
      setPosts((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...(m.reactions || {}) };
          let userReaction = m.userReaction;

          if (userReaction === emoji) {
            reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
            if (reactions[emoji] === 0) delete reactions[emoji];
            userReaction = undefined;
          } else {
            if (userReaction && reactions[userReaction]) {
              reactions[userReaction] = Math.max(0, reactions[userReaction] - 1);
              if (reactions[userReaction] === 0) delete reactions[userReaction];
            }
            reactions[emoji] = (reactions[emoji] || 0) + 1;
            userReaction = emoji;
          }
          return { ...m, reactions, userReaction };
        })
      );

      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'react',
          messageId,
          emoji,
          peerId: channel.id,
          peerUsername: channel.username,
        }),
      });
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  // Pin post
  const handleTogglePin = async (messageId: string) => {
    try {
      setPosts((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: !m.isPinned } : m))
      );

      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'pin',
          messageId,
          peerId: channel.id,
          peerUsername: channel.username,
        }),
      });
    } catch (err) {
      console.warn('Pin error:', err);
    }
  };

  // Vote on poll
  const handleVotePoll = async (messageId: string, optionIndex: number) => {
    try {
      setPosts((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.poll || m.poll.isClosed) return m;
          const poll = { ...m.poll };
          const opts = poll.options.map((o, idx) => {
            let votes = o.votes;
            if (idx === optionIndex && poll.userVotedIndex !== optionIndex) votes += 1;
            if (idx === poll.userVotedIndex && poll.userVotedIndex !== optionIndex) votes = Math.max(0, votes - 1);
            return { ...o, votes };
          });
          const totalVotes = poll.userVotedIndex === undefined ? (poll.totalVotes || 0) + 1 : poll.totalVotes;
          return { ...m, poll: { ...poll, options: opts, totalVotes, userVotedIndex: optionIndex } };
        })
      );

      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'vote',
          messageId,
          optionIndex,
        }),
      });
    } catch (err) {
      console.warn('Vote poll error:', err);
    }
  };

  useEffect(() => {
    fetchForumTopics();
  }, [channel.id]);

  useEffect(() => {
    fetchChannelPosts();
    const interval = setInterval(() => fetchChannelPosts(false), 8000);
    return () => clearInterval(interval);
  }, [channel.id, activeTopicId]);

  const toggleNotifications = async () => {
    const nextState = !notificationsOn;
    setNotificationsOn(nextState);
    try {
      await fetch('/api/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: channel.id,
          notificationsEnabled: nextState,
        }),
      });
      if (onNotificationToggled) onNotificationToggled(nextState);
    } catch (e) {
      console.error('Failed to toggle channel notifications:', e);
      setNotificationsOn(!nextState);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const activeTopic = topics.find((t) => t.id === activeTopicId);
  const pinnedPost = posts.find((p) => p.isPinned);

  const displayedPosts = activeHashtag
    ? posts.filter((p) => p.text && p.text.toLowerCase().includes(activeHashtag.toLowerCase()))
    : posts;

  return (
    <div className="flex flex-col h-full bg-stone-50 text-stone-900 select-text relative">
      {/* Channel Header */}
      <div className="px-4 py-3 bg-white/95 backdrop-blur-md border-b border-stone-200/90 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center space-x-3 truncate">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-stone-600 hover:text-stone-950 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Return to Channels"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0 shadow-2xs border border-stone-200">
              {channel.isGroup ? <Users className="w-4 h-4 text-sky-600" /> : <Radio className="w-4 h-4 text-sky-600" />}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-semibold tracking-tight text-stone-900 truncate">
                  {channel.title}
                </h1>
                <ShieldCheck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              </div>
              <p className="text-[11px] font-mono text-stone-400 truncate">
                @{channel.username || 'channel'}
                {activeTopic && (
                  <span className="ml-1.5 text-sky-600 font-sans font-medium">
                    • #{activeTopic.title}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {onRemoveChannel && (
            <button
              onClick={() => {
                if (window.confirm(`Remove "${channel.title}" from approved channels?`)) {
                  onRemoveChannel(channel.id);
                  onBack();
                }
              }}
              className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              title="Remove channel"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => fetchChannelPosts(true)}
            disabled={refreshing}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Sync latest posts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-stone-700' : ''}`} />
          </button>

          <button
            onClick={toggleNotifications}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all duration-150 cursor-pointer border ${
              notificationsOn
                ? 'bg-stone-900 text-stone-50 border-stone-900 hover:bg-stone-800'
                : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
            }`}
          >
            {notificationsOn ? (
              <>
                <Bell className="w-3 h-3 text-emerald-400" />
                <span>ON</span>
              </>
            ) : (
              <>
                <BellOff className="w-3 h-3 text-stone-400" />
                <span>MUTED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pinned Post Sticky Banner */}
      {pinnedPost && (
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-amber-900 z-10 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-semibold text-[11px] text-amber-800 shrink-0">Pinned:</span>
            <span className="truncate text-stone-700 font-sans text-xs">
              {pinnedPost.text || pinnedPost.media?.name || 'Media'}
            </span>
          </div>
          <button
            onClick={() => handleTogglePin(pinnedPost.id)}
            className="text-[10px] font-mono text-amber-700 hover:text-amber-950 underline shrink-0 ml-2 cursor-pointer"
          >
            Unpin
          </button>
        </div>
      )}

      {/* Forum Topics Bar */}
      {(isForum || topics.length > 0) && (
        <div className="bg-white border-b border-stone-200/90 px-3 py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-2xs z-10">
          <div className="flex items-center space-x-1 text-[10px] font-mono text-stone-400 uppercase tracking-wider shrink-0 mr-1 pl-1">
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            <span>Topics</span>
          </div>

          <button
            onClick={() => setActiveTopicId(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 border ${
              activeTopicId === null
                ? 'bg-stone-900 text-stone-50 border-stone-900 shadow-2xs'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
            }`}
          >
            All Posts
          </button>

          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTopicId(t.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 flex items-center space-x-1.5 border ${
                activeTopicId === t.id
                  ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                  : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
              }`}
            >
              {t.pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
              <span className="opacity-70 font-mono text-[11px]">#</span>
              <span className="truncate max-w-[140px]">{t.title}</span>
              {t.unreadCount && t.unreadCount > 0 ? (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-red-500 text-white font-bold">
                  {t.unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Active Hashtag Filter Pill */}
      {activeHashtag && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-1.5 flex items-center justify-between text-xs text-sky-900 z-10 shrink-0">
          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
            <Hash className="w-3.5 h-3.5 text-sky-600" />
            <span>Filtering by <strong className="font-semibold">{activeHashtag}</strong></span>
          </div>
          <button
            onClick={() => setActiveHashtag(null)}
            className="p-0.5 rounded text-sky-600 hover:text-sky-950 cursor-pointer"
            title="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Posts Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
            <Clock className="w-4 h-4 animate-spin text-stone-400" />
            <span>Loading verified dispatches...</span>
          </div>
        ) : displayedPosts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 max-w-xs mx-auto space-y-3">
            <Radio className="w-8 h-8 text-stone-300 stroke-1 mx-auto" />
            <p className="text-xs">
              {activeHashtag
                ? `No posts matching ${activeHashtag}`
                : activeTopic
                ? `No posts in topic #${activeTopic.title}.`
                : 'No posts currently available in this channel.'}
            </p>
            <button
              onClick={() => fetchChannelPosts(true)}
              className="text-[11px] font-mono text-stone-700 underline hover:text-black cursor-pointer"
            >
              ↻ Refresh Telegram Posts
            </button>
          </div>
        ) : (
          displayedPosts.map((post) => {
            const hasReactions = post.reactions && Object.keys(post.reactions).length > 0;

            return (
              <article
                key={post.id}
                className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-xs space-y-3 transition-all duration-150 hover:border-stone-300 group relative"
              >
                {/* Post Header: Sender, Pinned, Date */}
                <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-100 pb-2">
                  <div className="flex items-center space-x-1.5 truncate">
                    {post.isPinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    <span className="font-semibold text-stone-700 truncate">
                      {channel.isGroup && post.senderName ? post.senderName : channel.title}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-stone-400 shrink-0">
                    {post.isSilent && <span title="Silent post"><BellOff className="w-3 h-3" /></span>}
                    <time>{formatDate(post.date)}</time>
                  </div>
                </div>

                {/* Reply To snippet */}
                {post.replyToSnippet && (
                  <div className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-stone-50 border border-stone-200 text-stone-600 flex items-center space-x-1">
                    <CornerDownRight className="w-3 h-3 text-sky-500 shrink-0" />
                    <span className="truncate max-w-[240px]">{post.replyToSnippet}</span>
                  </div>
                )}

                {/* Forward attribution banner */}
                {post.forwardFrom && (
                  <div className="flex items-center space-x-1.5 text-[11px] font-medium text-sky-600 bg-sky-50/80 border-l-2 border-sky-500 rounded-r-md px-2.5 py-1">
                    <Share2 className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                    <span>Forwarded from <strong>{post.forwardFrom.name}</strong></span>
                  </div>
                )}

                {/* Render Media Image */}
                {post.media?.type === 'image' && (
                  <div className="overflow-hidden rounded-xl border border-stone-200/60 max-w-md shadow-2xs">
                    <img
                      src={post.media.url}
                      alt={post.media.name || 'Channel image'}
                      className="w-full max-h-80 object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
                      onClick={() => setLightboxImg(post.media?.url || null)}
                    />
                  </div>
                )}

                {/* Render Media Document */}
                {post.media?.type === 'document' && (
                  <a
                    href={post.media.url}
                    download={post.media.name || 'document'}
                    className="p-3 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 text-stone-800 flex items-center space-x-3 transition shadow-2xs"
                  >
                    <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                    <div className="overflow-hidden flex-1">
                      <p className="font-mono text-[11px] truncate font-medium">
                        {post.media.name || 'Document.pdf'}
                      </p>
                      {post.media.size && (
                        <p className="text-[10px] text-stone-500 font-mono">{post.media.size}</p>
                      )}
                    </div>
                    <Download className="w-4 h-4 text-stone-400 shrink-0" />
                  </a>
                )}

                {/* Poll rendering if present */}
                {post.poll && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs flex items-center space-x-1">
                        <span>📊 {post.poll.question}</span>
                      </span>
                      {post.poll.isQuiz && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                          QUIZ
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {post.poll.options.map((opt, idx) => {
                        const isSelected = post.poll?.userVotedIndex === idx;
                        const percent =
                          post.poll?.totalVotes && post.poll.totalVotes > 0
                            ? Math.round((opt.votes / post.poll.totalVotes) * 100)
                            : 0;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleVotePoll(post.id, idx)}
                            className={`w-full p-2.5 rounded-xl text-left text-xs font-medium border transition relative overflow-hidden flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'border-sky-500 bg-sky-50/60 text-sky-900'
                                : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-800'
                            }`}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-sky-100/50 transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                            <span className="relative z-10 flex items-center space-x-2 truncate">
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'border-stone-300'}`}>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="truncate">{opt.text}</span>
                            </span>
                            <span className="relative z-10 font-mono text-[10px] text-stone-500 shrink-0 ml-2">
                              {percent}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[10px] font-mono text-stone-500 pt-1 flex items-center justify-between">
                      <span>{post.poll.totalVotes || 0} votes</span>
                      {post.poll.explanation && post.poll.userVotedIndex !== undefined && (
                        <span className="text-emerald-700 italic">💡 {post.poll.explanation}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Text content with Clickable Links and Hashtags */}
                {post.text && (
                  <div className="text-xs text-stone-800 leading-relaxed font-sans">
                    <FormattedMessageText
                      text={post.text}
                      onHashtagClick={(tag) => setActiveHashtag(tag)}
                    />
                  </div>
                )}

                {/* Reaction Badges */}
                {hasReactions && (
                  <div className="flex items-center space-x-1 pt-1">
                    {Object.entries(post.reactions!).map(([emoji, count]) => {
                      const isMyReaction = post.userReaction === emoji;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(post.id, emoji)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-sans border transition cursor-pointer flex items-center space-x-1 shadow-2xs ${
                            isMyReaction
                              ? 'bg-sky-100 border-sky-300 text-sky-900 font-semibold'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-mono">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Floating Action Menu Capsule */}
                <div className="flex items-center space-x-1 pt-1 border-t border-stone-100 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    onClick={() => setReplyTo(post)}
                    className="p-1 rounded-md text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer flex items-center space-x-1 text-[11px]"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>

                  <button
                    onClick={() =>
                      setActiveReactionMsgId(activeReactionMsgId === post.id ? null : post.id)
                    }
                    className="p-1 rounded-md text-stone-400 hover:text-amber-500 hover:bg-stone-100 transition cursor-pointer flex items-center space-x-1 text-[11px]"
                    title="React"
                  >
                    <Smile className="w-3.5 h-3.5" />
                    <span>React</span>
                  </button>

                  <button
                    onClick={() => setMessageToForward(post)}
                    className="p-1 rounded-md text-stone-400 hover:text-sky-600 hover:bg-stone-100 transition cursor-pointer flex items-center space-x-1 text-[11px]"
                    title="Forward"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Forward</span>
                  </button>

                  <button
                    onClick={() => handleTogglePin(post.id)}
                    className={`p-1 rounded-md transition cursor-pointer flex items-center space-x-1 text-[11px] ${
                      post.isPinned ? 'text-amber-600' : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'
                    }`}
                    title={post.isPinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin className={`w-3.5 h-3.5 ${post.isPinned ? 'fill-amber-600' : ''}`} />
                    <span>{post.isPinned ? 'Unpin' : 'Pin'}</span>
                  </button>
                </div>

                {/* Floating Quick Reaction Bar */}
                {activeReactionMsgId === post.id && (
                  <div className="absolute z-30 bottom-10 left-4 bg-white/95 backdrop-blur-md border border-stone-200 rounded-full px-2 py-1 shadow-lg flex items-center space-x-1.5 animate-in zoom-in-95 duration-100">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(post.id, emoji)}
                        className="hover:scale-125 transition-transform duration-100 text-sm p-0.5 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveReactionMsgId(null)}
                      className="p-0.5 text-stone-400 hover:text-stone-700 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Reply Snippet Preview Above Composer */}
      {replyTo && (
        <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <CornerDownRight className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-stone-800">{replyTo.senderName}: </span>
              <span className="text-stone-500 font-sans">{replyTo.text || 'Attachment'}</span>
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Media Chip */}
      {selectedMedia && (
        <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            {selectedMedia.type === 'image' ? (
              <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-medium text-stone-800 truncate">{selectedMedia.name}</span>
          </div>
          <button
            onClick={() => setSelectedMedia(null)}
            className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scheduled message indicator */}
      {scheduledTime && (
        <div className="px-4 py-1.5 bg-sky-50 border-t border-sky-200 flex items-center justify-between text-[11px] text-sky-900">
          <span className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>Scheduled for {new Date(scheduledTime).toLocaleString()}</span>
          </span>
          <button onClick={() => setScheduledTime('')} className="p-0.5 hover:text-sky-950">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Silent mode active indicator */}
      {isSilent && (
        <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-[11px] text-amber-900">
          <span className="flex items-center space-x-1.5">
            <BellOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Silent post (members will not hear notification sound)</span>
          </span>
          <button type="button" onClick={() => setIsSilent(false)} className="p-0.5 hover:text-amber-950">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Self-destruct TTL active indicator */}
      {ttlSeconds > 0 && (
        <div className="px-4 py-1.5 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-[11px] text-rose-900">
          <span className="flex items-center space-x-1.5">
            <Timer className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Self-destruct timer: {TTL_OPTIONS.find((t) => t.seconds === ttlSeconds)?.label} after read</span>
          </span>
          <button type="button" onClick={() => setTtlSeconds(0)} className="p-0.5 hover:text-rose-950">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Post Composer for Channels & Groups */}
      <form
        onSubmit={(e) => handleSendMessage(e)}
        className="p-3 bg-white border-t border-stone-200/90 flex flex-col shrink-0 z-10 relative"
      >
        {/* Attachment & Features Popup Drawer */}
        {showAttachmentMenu && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => {
                setShowAttachmentMenu(false);
                setShowTtlMenu(false);
                setShowScheduleMenu(false);
              }}
            />
            <div className="absolute bottom-16 left-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-2xl z-30 w-72 max-w-[calc(100vw-24px)] animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold">
                  Attachments & Tools
                </span>
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Camera */}
                <button
                  type="button"
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setShowAttachmentMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-stone-50 transition cursor-pointer group text-stone-700"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-105 transition shadow-2xs">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium">Camera</span>
                </button>

                {/* File */}
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAttachmentMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-stone-50 transition cursor-pointer group text-stone-700"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1 group-hover:scale-105 transition shadow-2xs">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium">File</span>
                </button>

                {/* Poll */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPollModalOpen(true);
                    setShowAttachmentMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-stone-50 transition cursor-pointer group text-stone-700"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mb-1 group-hover:scale-105 transition shadow-2xs">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium">Poll</span>
                </button>

                {/* Silent Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSilent(!isSilent);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer group ${
                    isSilent ? 'bg-amber-50 text-amber-900 font-semibold' : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition shadow-2xs ${
                      isSilent ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {isSilent ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <span className="text-[11px] font-medium">{isSilent ? 'Silent ON' : 'Silent'}</span>
                </button>

                {/* TTL Timer */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTtlMenu(!showTtlMenu);
                    setShowScheduleMenu(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer group ${
                    ttlSeconds > 0 ? 'bg-rose-50 text-rose-900 font-semibold' : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition shadow-2xs ${
                      ttlSeconds > 0 ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    <Timer className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium">
                    {ttlSeconds > 0 ? `${TTL_OPTIONS.find((t) => t.seconds === ttlSeconds)?.label}` : 'Timer'}
                  </span>
                </button>

                {/* Schedule */}
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleMenu(!showScheduleMenu);
                    setShowTtlMenu(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer group ${
                    scheduledTime ? 'bg-sky-50 text-sky-900 font-semibold' : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition shadow-2xs ${
                      scheduledTime ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-600'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium">Schedule</span>
                </button>
              </div>

              {/* Submenu for TTL */}
              {showTtlMenu && (
                <div className="mt-2 pt-2 border-t border-stone-100">
                  <span className="block text-[10px] font-mono uppercase text-stone-400 mb-1.5">
                    Auto-delete after:
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {TTL_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        type="button"
                        onClick={() => {
                          setTtlSeconds(opt.seconds);
                          setShowTtlMenu(false);
                        }}
                        className={`px-1.5 py-1 text-xs rounded-lg text-center transition font-mono cursor-pointer ${
                          ttlSeconds === opt.seconds
                            ? 'bg-rose-500 text-white font-semibold'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submenu for Schedule */}
              {showScheduleMenu && (
                <div className="mt-2 pt-2 border-t border-stone-100 space-y-2">
                  <span className="block text-[10px] font-mono uppercase text-stone-400">
                    Broadcast later at:
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2 font-mono"
                  />
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduledTime(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
                        setShowScheduleMenu(false);
                      }}
                      className="flex-1 py-1 text-[11px] font-mono bg-stone-100 hover:bg-stone-200 rounded text-stone-700 cursor-pointer"
                    >
                      In 1 hour
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScheduleMenu(false)}
                      className="px-3 py-1 text-[11px] bg-sky-500 text-white rounded font-medium cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Input Row */}
        <div className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* Attachment Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer relative ${
              showAttachmentMenu || isSilent || ttlSeconds > 0 || scheduledTime
                ? 'bg-sky-100 text-sky-700'
                : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
            }`}
            title="Attach file, photo, poll, or options"
          >
            <Paperclip className="w-5 h-5 stroke-[2]" />
            {(isSilent || ttlSeconds > 0 || scheduledTime) && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-sky-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Message Input with Draft Autosave */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={
              activeTopic
                ? `Message in #${activeTopic.title}...`
                : channel.isGroup
                ? 'Message group...'
                : `Broadcast to ${channel.title.replace(/[^\w\s]/gi, '').trim()}...`
            }
            className="min-w-0 flex-1 px-4 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-full focus:outline-none focus:border-stone-400 focus:bg-white transition placeholder:text-stone-400 font-sans"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedMedia) || sending}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm cursor-pointer ${
              (inputText.trim() || selectedMedia) && !sending
                ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25 active:scale-95'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-60'
            }`}
            title={scheduledTime ? 'Schedule Broadcast' : 'Send'}
          >
            <Send className="w-4 h-4 stroke-[2.2] ml-0.5" />
          </button>
        </div>
      </form>

      {/* Forward Modal */}
      <ForwardModal
        isOpen={Boolean(messageToForward)}
        onClose={() => setMessageToForward(null)}
        messageToForward={messageToForward}
        contacts={allContacts}
        channels={allChannels}
        onForwardSuccess={() => fetchChannelPosts(true)}
      />

      {/* Poll Modal */}
      <PollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        onCreatePoll={(poll) => handleSendMessage(undefined, poll)}
      />

      {/* Lightbox for viewing full-screen photos */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImg(null)}
        >
          <div className="absolute top-4 right-4 flex items-center space-x-3 z-10">
            <a
              href={lightboxImg}
              download="channel-image.jpg"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title="Download image"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => setLightboxImg(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImg}
            alt="Full size view"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
