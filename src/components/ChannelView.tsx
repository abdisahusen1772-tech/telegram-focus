'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Bell, BellOff, Radio, ShieldCheck, Clock, Send, Users, Lock, FileText, Download, X, Paperclip, Camera, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { ApprovedChannel, Message } from '@/lib/types';

interface ChannelViewProps {
  channel: ApprovedChannel;
  onBack: () => void;
  onNotificationToggled?: (enabled: boolean) => void;
}

export function ChannelView({ channel, onBack, onNotificationToggled }: ChannelViewProps) {
  const [posts, setPosts] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(channel.notificationsEnabled);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'document';
    name: string;
    size?: string;
    url: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    if (token) {
      headers['x-telegram-session'] = token;
    }
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

  const fetchChannelPosts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/messages?peerId=${encodeURIComponent(channel.id)}`, {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if ((!text && !selectedMedia) || sending) return;

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
          text,
          media: selectedMedia || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInputText('');
        setSelectedMedia(null);
        setPosts((prev) => [...prev, data.message]);
      }
    } catch (err) {
      console.error('Failed to send group message:', err);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchChannelPosts();
    const interval = setInterval(() => fetchChannelPosts(false), 8000);
    return () => clearInterval(interval);
  }, [channel.id]);

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

  return (
    <div className="flex flex-col h-full bg-stone-50 text-stone-900 select-text relative">
      {/* Channel Header */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur-xs border-b border-stone-200/90 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-stone-600 hover:text-stone-950 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Return to Channels"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-sm font-semibold tracking-tight text-stone-900">
                {channel.title}
              </h1>
              <span title="User-Approved Channel">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
              </span>
            </div>
            <p className="text-[11px] font-mono text-stone-400">
              @{channel.username}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => fetchChannelPosts(true)}
            disabled={refreshing}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition cursor-pointer"
            title="Sync latest posts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-stone-700' : ''}`} />
          </button>

          {/* Per-Channel Notification Toggle */}
          <button
            onClick={toggleNotifications}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-mono transition-all duration-150 cursor-pointer border ${
              notificationsOn
                ? 'bg-stone-900 text-stone-50 border-stone-900 hover:bg-stone-800'
                : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
            }`}
            title={notificationsOn ? 'Notifications Active' : 'Notifications Muted'}
          >
            {notificationsOn ? (
              <>
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                <span>NOTIFS ON</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-stone-400" />
                <span>MUTED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Distraction-Free Notification Guarantee Banner */}
      <div className="bg-stone-100/80 border-b border-stone-200/70 px-4 py-2 text-[11px] text-stone-600 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase text-stone-500">Privacy rule</span>
        <span className="font-mono text-stone-500 text-[10px]">
          Preview: Hidden (&ldquo;New post in {channel.title.replace(/[^\w\s]/gi, '').trim()}&rdquo;)
        </span>
      </div>

      {/* About Box if provided */}
      {channel.about && (
        <div className="px-4 py-3 bg-white/70 border-b border-stone-200/80 text-xs text-stone-600 leading-relaxed font-sans">
          {channel.about}
        </div>
      )}

      {/* Chronological Posts Stream (No Algorithms, No Likes, No Recommendations) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
            <Clock className="w-4 h-4 animate-spin text-stone-400" />
            <span>Loading verified dispatches...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 max-w-xs mx-auto space-y-3">
            <Radio className="w-8 h-8 text-stone-300 stroke-1 mx-auto" />
            <p className="text-xs">No posts currently available in this channel.</p>
            <button
              onClick={() => fetchChannelPosts(true)}
              className="text-[11px] font-mono text-stone-700 underline hover:text-black cursor-pointer"
            >
              ↻ Refresh Telegram Posts
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-2.5 transition-all duration-150 hover:border-stone-300"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-100 pb-2">
                <span className="font-medium text-stone-600">
                  {channel.isGroup && post.senderName ? post.senderName : channel.title}
                </span>
                <time>{formatDate(post.date)}</time>
              </div>

              {/* Render Media Image */}
              {post.media?.type === 'image' && (
                <div className="overflow-hidden rounded-lg border border-stone-200/60 max-w-sm">
                  <img
                    src={post.media.url}
                    alt={post.media.name || 'Channel image'}
                    className="w-full max-h-72 object-cover rounded-lg cursor-pointer hover:opacity-95 transition"
                    onClick={() => setLightboxImg(post.media?.url || null)}
                  />
                </div>
              )}

              {/* Render Media Document */}
              {post.media?.type === 'document' && (
                <a
                  href={post.media.url}
                  download={post.media.name || 'document'}
                  className="p-2.5 bg-stone-100/90 hover:bg-stone-200/80 rounded-lg border border-stone-200 text-stone-800 flex items-center space-x-2.5 transition"
                >
                  <FileText className="w-5 h-5 text-stone-600 shrink-0" />
                  <div className="overflow-hidden flex-1">
                    <p className="font-mono text-[11px] truncate font-medium">
                      {post.media.name || 'Document.pdf'}
                    </p>
                    {post.media.size && (
                      <p className="text-[10px] text-stone-500 font-mono">{post.media.size}</p>
                    )}
                  </div>
                  <Download className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                </a>
              )}

              {/* Text content */}
              {post.text && (
                <div className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {post.text}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Attachment Preview Chip for Groups */}
      {selectedMedia && (
        <div className="px-4 py-2 bg-stone-100/95 border-t border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 overflow-hidden">
            {selectedMedia.type === 'image' ? (
              <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <div className="truncate">
              <span className="font-semibold text-stone-800">{selectedMedia.name} </span>
              <span className="text-stone-500 font-mono text-[10px]">({selectedMedia.size})</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMedia(null)}
            className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
            title="Remove attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Group Message Composer if this is a group chat */}
      {channel.isGroup && (
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-stone-200/90 flex items-center space-x-1.5 shrink-0"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
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

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Take photo with camera"
          >
            <Camera className="w-4 h-4 stroke-[2]" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Attach file or photo"
          >
            <Paperclip className="w-4 h-4 stroke-[2]" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${channel.title.replace(/[^\w\s]/gi, '').trim()}...`}
            className="flex-1 px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 focus:bg-white transition placeholder:text-stone-400 font-normal"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedMedia) || sending}
            className="p-2.5 bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 rounded-lg transition-all duration-150 flex items-center justify-center cursor-pointer shadow-xs"
            title="Send to group"
          >
            <Send className="w-4 h-4 stroke-[2]" />
          </button>
        </form>
      )}

      {/* Lightbox for viewing full-screen photos in channel */}
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
              title="Close image"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImg}
            alt="Full size view"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
