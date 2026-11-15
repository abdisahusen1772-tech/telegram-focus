'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Reply,
  X,
  FileText,
  Play,
  Pause,
  CheckCheck,
  Clock,
  ShieldCheck,
  RefreshCw,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Download,
  ExternalLink,
  UserMinus,
  Pin,
  Share2,
  Smile,
  BellOff,
  Bell,
  Timer,
  Calendar,
  BarChart3,
  CornerDownRight,
  ChevronDown,
  Hash,
} from 'lucide-react';
import { ApprovedContact, ApprovedChannel, Message, MessagePoll } from '@/lib/types';
import { FormattedMessageText } from '@/components/FormattedMessageText';
import { ForwardModal } from '@/components/ForwardModal';
import { PollModal } from '@/components/PollModal';

interface ConversationViewProps {
  contact: ApprovedContact;
  onBack: () => void;
  onMessageSent?: () => void;
  onRemoveContact?: (id: string) => void;
  allContacts?: ApprovedContact[];
  allChannels?: ApprovedChannel[];
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '👏', '🚀', '🎉'];
const TTL_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '10s', seconds: 10 },
  { label: '1m', seconds: 60 },
  { label: '1h', seconds: 3600 },
  { label: '24h', seconds: 86400 },
];

export function ConversationView({
  contact,
  onBack,
  onMessageSent,
  onRemoveContact,
  allContacts = [],
  allChannels = [],
}: ConversationViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'document';
    name: string;
    size?: string;
    url: string;
  } | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Restore draft on chat open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const draft = localStorage.getItem(`draft_${contact.id}`);
      if (draft) {
        setInputText(draft);
      }
    }
  }, [contact.id]);

  // Save draft on change
  const handleInputChange = (val: string) => {
    setInputText(val);
    if (typeof window !== 'undefined') {
      if (val.trim()) {
        localStorage.setItem(`draft_${contact.id}`, val);
      } else {
        localStorage.removeItem(`draft_${contact.id}`);
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
    return headers;
  };

  const fetchConversation = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const params = new URLSearchParams({
        peerId: contact.id,
        username: contact.username || '',
        name: contact.firstName || '',
      });
      const res = await fetch(`/api/messages?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error('Error fetching messages:', e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversation();
    const interval = setInterval(() => fetchConversation(false), 7000);
    return () => clearInterval(interval);
  }, [contact.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          peerId: contact.id,
          text: pollData ? `📊 ${pollData.question}` : text,
          media: selectedMedia || undefined,
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
          localStorage.removeItem(`draft_${contact.id}`);
        }
        setSelectedMedia(null);
        setReplyTo(null);
        setScheduledTime('');
        setShowAttachmentMenu(false);
        setShowTtlMenu(false);
        setShowScheduleMenu(false);
        setMessages((prev) => [...prev, data.message]);
        if (onMessageSent) onMessageSent();
      } else {
        alert(data.error || 'Failed to deliver message');
      }
    } catch (e) {
      console.error('Error sending message:', e);
    } finally {
      setSending(false);
    }
  };

  // Reactions
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveReactionMsgId(null);
    try {
      // Optimistic update
      setMessages((prev) =>
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
          peerId: contact.id,
          peerUsername: contact.username,
        }),
      });
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  // Pin message
  const handleTogglePin = async (messageId: string) => {
    try {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: !m.isPinned } : m))
      );

      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'pin',
          messageId,
          peerId: contact.id,
          peerUsername: contact.username,
        }),
      });
    } catch (err) {
      console.warn('Pin error:', err);
    }
  };

  // Vote on poll
  const handleVotePoll = async (messageId: string, optionIndex: number) => {
    try {
      setMessages((prev) =>
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

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const pinnedMessage = messages.find((m) => m.isPinned);

  // Filter messages by active hashtag if selected
  const displayedMessages = activeHashtag
    ? messages.filter((m) => m.text && m.text.toLowerCase().includes(activeHashtag.toLowerCase()))
    : messages;

  return (
    <div className="flex flex-col h-full bg-stone-50 text-stone-900 select-text relative">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white/95 backdrop-blur-md border-b border-stone-200/90 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center space-x-3 truncate">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-stone-600 hover:text-stone-950 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Return to Contacts"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center text-xs font-bold shrink-0 uppercase shadow-xs">
              {contact.firstName ? contact.firstName[0] : 'U'}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-semibold tracking-tight text-stone-900 truncate">
                  {contact.firstName} {contact.lastName || ''}
                </h1>
                <span title="Verified Contact"><ShieldCheck className="w-3.5 h-3.5 text-stone-400 shrink-0" /></span>
              </div>
              <p className="text-[11px] font-mono text-stone-400 truncate">
                @{contact.username || 'user'} • Direct Chat
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {onRemoveContact && (
            <button
              onClick={() => {
                const name = `${contact.firstName} ${contact.lastName || ''}`.trim();
                if (window.confirm(`Remove ${name} from approved contacts?`)) {
                  onRemoveContact(contact.id);
                  onBack();
                }
              }}
              className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              title="Remove contact"
            >
              <UserMinus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => fetchConversation(true)}
            disabled={refreshing}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Sync latest messages"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-stone-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pinned Message Sticky Banner */}
      {pinnedMessage && (
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-amber-900 z-10 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-semibold text-[11px] text-amber-800 shrink-0">Pinned:</span>
            <span className="truncate text-stone-700 font-sans text-xs">
              {pinnedMessage.text || pinnedMessage.media?.name || 'Media'}
            </span>
          </div>
          <button
            onClick={() => handleTogglePin(pinnedMessage.id)}
            className="text-[10px] font-mono text-amber-700 hover:text-amber-950 underline shrink-0 ml-2 cursor-pointer"
          >
            Unpin
          </button>
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

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
            <Clock className="w-4 h-4 animate-spin text-stone-400" />
            <span>Opening conversation...</span>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 max-w-xs mx-auto">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-2 text-stone-400 font-mono text-base font-semibold">
              {contact.firstName ? contact.firstName[0] : 'U'}
            </div>
            <p className="text-xs font-semibold text-stone-700">
              {activeHashtag ? `No messages found with ${activeHashtag}` : 'No previous messages'}
            </p>
            <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
              {activeHashtag ? 'Try selecting another hashtag.' : 'Send a message below to start communicating.'}
            </p>
          </div>
        ) : (
          displayedMessages.map((msg) => {
            const isMe = msg.isOutgoing;
            const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
              >
                {/* Reply to preview snippet */}
                {msg.replyToSnippet && (
                  <div
                    className={`text-[10px] font-mono mb-1 px-2.5 py-1 rounded-md border flex items-center space-x-1 ${
                      isMe
                        ? 'bg-stone-100/90 text-stone-600 border-stone-200'
                        : 'bg-stone-100/90 text-stone-600 border-stone-200'
                    }`}
                  >
                    <CornerDownRight className="w-3 h-3 text-sky-500 shrink-0" />
                    <span className="truncate max-w-[200px]">{msg.replyToSnippet}</span>
                  </div>
                )}

                {/* Forward attribution banner */}
                {msg.forwardFrom && (
                  <div className="text-[10px] font-sans text-sky-600 font-medium mb-1 px-2 flex items-center space-x-1">
                    <Share2 className="w-3 h-3 text-sky-500" />
                    <span>Forwarded from {msg.forwardFrom.name}</span>
                  </div>
                )}

                {/* Bubble Container */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed relative shadow-xs transition-all duration-150 ${
                    isMe
                      ? 'bg-stone-900 text-stone-50 border border-stone-800 rounded-tr-xs'
                      : 'bg-white text-stone-900 border border-stone-200/90 rounded-tl-xs'
                  }`}
                >
                  {/* Pinned Indicator badge */}
                  {msg.isPinned && (
                    <div className="flex items-center space-x-1 text-[9px] font-mono text-amber-400 pb-1 mb-1 border-b border-white/10">
                      <Pin className="w-2.5 h-2.5 fill-amber-400" />
                      <span>Pinned message</span>
                    </div>
                  )}

                  {/* Media: Image */}
                  {msg.media?.type === 'image' && (
                    <div className="mb-2 overflow-hidden rounded-xl border border-stone-200/60 max-w-sm">
                      <img
                        src={msg.media.url}
                        alt={msg.media.name || 'Shared image'}
                        className="w-full max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
                        onClick={() => setLightboxImg(msg.media?.url || null)}
                      />
                    </div>
                  )}

                  {/* Media: Document */}
                  {msg.media?.type === 'document' && (
                    <a
                      href={msg.media.url}
                      download={msg.media.name || 'document'}
                      className="mb-2 p-2.5 bg-stone-100/90 hover:bg-stone-200/80 rounded-xl border border-stone-200 text-stone-800 flex items-center space-x-2.5 transition shadow-2xs"
                    >
                      <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                      <div className="overflow-hidden flex-1">
                        <p className="font-mono text-[11px] truncate font-medium">
                          {msg.media.name || 'Document.pdf'}
                        </p>
                        {msg.media.size && (
                          <p className="text-[10px] text-stone-500 font-mono">{msg.media.size}</p>
                        )}
                      </div>
                      <Download className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    </a>
                  )}

                  {/* Poll rendering if present */}
                  {msg.poll && (
                    <div className="p-3 bg-stone-100/90 text-stone-900 rounded-xl border border-stone-200 mb-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs flex items-center space-x-1">
                          <span>📊 {msg.poll.question}</span>
                        </span>
                        {msg.poll.isQuiz && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                            QUIZ
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {msg.poll.options.map((opt, idx) => {
                          const isSelected = msg.poll?.userVotedIndex === idx;
                          const percent =
                            msg.poll?.totalVotes && msg.poll.totalVotes > 0
                              ? Math.round((opt.votes / msg.poll.totalVotes) * 100)
                              : 0;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleVotePoll(msg.id, idx)}
                              className={`w-full p-2 rounded-lg text-left text-xs font-medium border transition relative overflow-hidden flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-sky-500 bg-sky-50 text-sky-900'
                                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-800'
                              }`}
                            >
                              {/* Percentage fill bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-sky-100/50 transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                              <span className="relative z-10 flex items-center space-x-1.5 truncate">
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
                        <span>{msg.poll.totalVotes || 0} votes</span>
                        {msg.poll.explanation && msg.poll.userVotedIndex !== undefined && (
                          <span className="text-emerald-700 italic">💡 {msg.poll.explanation}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Text with Clickable Links and Hashtags */}
                  {msg.text && (
                    <div className="text-xs leading-relaxed font-sans">
                      <FormattedMessageText
                        text={msg.text}
                        onHashtagClick={(tag) => setActiveHashtag(tag)}
                        linkClassName={
                          isMe
                            ? 'text-sky-300 hover:text-sky-200 underline underline-offset-2 break-all font-medium'
                            : 'text-sky-600 hover:text-sky-500 underline underline-offset-2 break-all font-medium'
                        }
                      />
                    </div>
                  )}

                  {/* Footer Meta: Time, Self-destruct timer, Silent badge, Delivery check */}
                  <div
                    className={`mt-1.5 flex items-center justify-end space-x-1.5 text-[10px] font-mono ${
                      isMe ? 'text-stone-400' : 'text-stone-400'
                    }`}
                  >
                    {msg.isSilent && <span title="Silent Message"><BellOff className="w-3 h-3 text-stone-400" /></span>}
                    {msg.expiresAt && (
                      <span className="flex items-center space-x-0.5 text-amber-500" title="Self-destructing message">
                        <Timer className="w-3 h-3" />
                        <span>TTL</span>
                      </span>
                    )}
                    <span>{formatTime(msg.date)}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-stone-400 ml-0.5" />}
                  </div>
                </div>

                {/* Reaction Badges Below Bubble */}
                {hasReactions && (
                  <div className={`flex items-center space-x-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions!).map(([emoji, count]) => {
                      const isMyReaction = msg.userReaction === emoji;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji)}
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

                {/* Floating Action Menu Triggered on Hover/Tap */}
                <div
                  className={`opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center space-x-1 mt-1 ${
                    isMe ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                  }`}
                >
                  {/* Reply Button */}
                  <button
                    onClick={() => setReplyTo(msg)}
                    className="p-1 rounded-md text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  {/* Reaction Button */}
                  <button
                    onClick={() =>
                      setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)
                    }
                    className="p-1 rounded-md text-stone-400 hover:text-amber-500 hover:bg-stone-100 transition cursor-pointer"
                    title="Add reaction"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {/* Forward Button */}
                  <button
                    onClick={() => setMessageToForward(msg)}
                    className="p-1 rounded-md text-stone-400 hover:text-sky-600 hover:bg-stone-100 transition cursor-pointer"
                    title="Forward"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Pin Button */}
                  <button
                    onClick={() => handleTogglePin(msg.id)}
                    className={`p-1 rounded-md transition cursor-pointer ${
                      msg.isPinned
                        ? 'text-amber-600 hover:text-amber-700'
                        : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'
                    }`}
                    title={msg.isPinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-amber-600' : ''}`} />
                  </button>
                </div>

                {/* Floating Quick Reaction Emoji Bar */}
                {activeReactionMsgId === msg.id && (
                  <div
                    className={`absolute z-30 -top-8 ${
                      isMe ? 'right-0' : 'left-0'
                    } bg-white/95 backdrop-blur-md border border-stone-200 rounded-full px-2 py-1 shadow-lg flex items-center space-x-1.5 animate-in zoom-in-95 duration-100`}
                  >
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
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
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
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
            <span>Silent message (recipient will not hear notification sound)</span>
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

      {/* Modern Composer Bar */}
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
                    Send later at:
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
            placeholder={`Message ${contact.firstName}...`}
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
            title={scheduledTime ? 'Schedule Message' : 'Send'}
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
        onForwardSuccess={() => fetchConversation(true)}
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
              download="telegram-image.jpg"
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
