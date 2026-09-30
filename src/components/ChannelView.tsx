'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, BellOff, Radio, ShieldCheck, Clock } from 'lucide-react';
import { ApprovedChannel, Message } from '@/lib/types';

interface ChannelViewProps {
  channel: ApprovedChannel;
  onBack: () => void;
  onNotificationToggled?: (enabled: boolean) => void;
}

export function ChannelView({ channel, onBack, onNotificationToggled }: ChannelViewProps) {
  const [posts, setPosts] = useState<Message[]>([]);
  const [notificationsOn, setNotificationsOn] = useState(channel.notificationsEnabled);
  const [loading, setLoading] = useState(true);

  const fetchChannelPosts = async () => {
    try {
      const res = await fetch(`/api/messages?peerId=${channel.id}`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.messages);
      }
    } catch (e) {
      console.error('Error fetching channel posts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannelPosts();
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
    <div className="flex flex-col h-full bg-stone-50 text-stone-900 select-text">
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

        {/* Per-Channel Notification Toggle */}
        <button
          onClick={toggleNotifications}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono transition-all duration-150 cursor-pointer border ${
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
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 max-w-xs mx-auto">
            <Radio className="w-8 h-8 text-stone-300 mb-2 stroke-1" />
            <p className="text-xs">No posts currently available in this channel.</p>
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-2xs space-y-2.5 transition-all duration-150 hover:border-stone-300"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-100 pb-2">
                <span className="font-medium text-stone-600">{channel.title}</span>
                <time>{formatDate(post.date)}</time>
              </div>

              <div className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-sans">
                {post.text}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
