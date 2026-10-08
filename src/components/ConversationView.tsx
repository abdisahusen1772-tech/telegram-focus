'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Reply, X, FileText, Play, Pause, CheckCheck, Clock, ShieldCheck, RefreshCw, Paperclip, Image as ImageIcon, Download } from 'lucide-react';
import { ApprovedContact, Message } from '@/lib/types';

interface ConversationViewProps {
  contact: ApprovedContact;
  onBack: () => void;
  onMessageSent?: () => void;
}

export function ConversationView({ contact, onBack, onMessageSent }: ConversationViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'document';
    name: string;
    size?: string;
    url: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const token = localStorage.getItem('tg_focus_session');
    return token ? { 'x-telegram-session': token } : {};
  };

  const fetchConversation = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/messages?peerId=${encodeURIComponent(contact.id)}`, {
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
    const interval = setInterval(() => fetchConversation(false), 4000);
    return () => clearInterval(interval);
  }, [contact.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          peerId: contact.id,
          text,
          media: selectedMedia || undefined,
          replyToId: replyTo?.id,
          replyToSnippet: replyTo ? `${replyTo.senderName}: ${replyTo.text.slice(0, 45)}...` : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setInputText('');
        setSelectedMedia(null);
        setReplyTo(null);
        setMessages((prev) => [...prev, data.message]);
        if (onMessageSent) onMessageSent();
      }
    } catch (e) {
      console.error('Error sending message:', e);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 text-stone-900 select-text">
      {/* Intentional Conversation Header */}
      <div className="px-4 py-3 bg-white/90 backdrop-blur-xs border-b border-stone-200/90 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-stone-600 hover:text-stone-950 rounded-lg hover:bg-stone-100 transition cursor-pointer"
            title="Return to Home"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-sm font-semibold tracking-tight text-stone-900">
                {contact.firstName} {contact.lastName || ''}
              </h1>
              <span title="Verified Approved Contact">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
              </span>
            </div>
            <p className="text-[11px] font-mono text-stone-400">
              @{contact.username}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchConversation(true)}
            disabled={refreshing}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition cursor-pointer"
            title="Sync latest messages"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-stone-700' : ''}`} />
          </button>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 hidden sm:inline-block">
            Encrypted Session
          </span>
        </div>
      </div>

      {/* Messages Feed (Chronological, No Algorithms, No Engagement Bait) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
            <Clock className="w-4 h-4 animate-spin text-stone-400" />
            <span>Opening conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 max-w-xs mx-auto">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mb-2 text-stone-400 font-mono text-sm">
              {contact.firstName[0]}
            </div>
            <p className="text-xs font-medium text-stone-700">No previous messages</p>
            <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
              This conversation is strictly private. Enter your message below to communicate deliberately.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.isOutgoing;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                {/* Optional reply snippet */}
                {msg.replyToSnippet && (
                  <div
                    className={`text-[10px] font-mono mb-1 px-2.5 py-1 rounded border ${
                      isMe
                        ? 'bg-stone-100/90 text-stone-600 border-stone-200'
                        : 'bg-stone-100/90 text-stone-600 border-stone-200'
                    }`}
                  >
                    ↳ {msg.replyToSnippet}
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed relative shadow-2xs ${
                    isMe
                      ? 'bg-stone-900 text-stone-50 border border-stone-800'
                      : 'bg-white text-stone-900 border border-stone-200/90'
                  }`}
                >
                  {/* Media: Image */}
                  {msg.media?.type === 'image' && (
                    <div className="mb-2 overflow-hidden rounded-lg border border-stone-200/60 max-w-sm">
                      <img
                        src={msg.media.url}
                        alt={msg.media.name || 'Shared image'}
                        className="w-full max-h-72 object-cover rounded-lg cursor-pointer hover:opacity-95 transition"
                        onClick={() => window.open(msg.media?.url, '_blank')}
                      />
                    </div>
                  )}

                  {/* Media: Document */}
                  {msg.media?.type === 'document' && (
                    <a
                      href={msg.media.url}
                      download={msg.media.name || 'document'}
                      className="mb-2 p-2.5 bg-stone-100/90 hover:bg-stone-200/80 rounded-lg border border-stone-200 text-stone-800 flex items-center space-x-2.5 transition"
                    >
                      <FileText className="w-5 h-5 text-stone-600 shrink-0" />
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

                  {/* Media: Voice message */}
                  {msg.media?.type === 'voice' && (
                    <div className="mb-2 p-2.5 bg-stone-100/80 rounded-lg border border-stone-200 text-stone-800 flex items-center space-x-3">
                      <button
                        onClick={() =>
                          setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)
                        }
                        className="p-1.5 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition cursor-pointer"
                      >
                        {playingVoiceId === msg.id ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="h-1.5 bg-stone-200 rounded-full w-full overflow-hidden">
                          <div
                            className={`h-full bg-stone-800 rounded-full transition-all duration-300 ${
                              playingVoiceId === msg.id ? 'w-3/4 animate-pulse' : 'w-0'
                            }`}
                          />
                        </div>
                        <p className="text-[10px] font-mono text-stone-500 mt-1">
                          Voice message ({msg.media.duration || 14}s)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Message Text */}
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                  {/* Message meta */}
                  <div
                    className={`mt-1.5 flex items-center justify-end space-x-1 text-[10px] font-mono ${
                      isMe ? 'text-stone-400' : 'text-stone-400'
                    }`}
                  >
                    <span>{formatTime(msg.date)}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-stone-400 ml-0.5" />}
                  </div>
                </div>

                {/* Subtle Reply Button */}
                <button
                  onClick={() => setReplyTo(msg)}
                  className="opacity-0 group-hover:opacity-100 mt-1 text-[10px] text-stone-400 hover:text-stone-700 flex items-center space-x-1 px-1 transition cursor-pointer"
                >
                  <Reply className="w-3 h-3" />
                  <span>Reply</span>
                </button>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Quote Banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Reply className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-stone-800">Replying to {replyTo.senderName}: </span>
              <span className="text-stone-500 font-mono truncate">{replyTo.text.slice(0, 50)}</span>
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

      {/* Attachment Preview Chip */}
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

      {/* Message Input Box (Deliberate & Distraction-Free) */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-white border-t border-stone-200/90 flex items-center space-x-2 shrink-0"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          title="Attach image or file"
        >
          <Paperclip className="w-4 h-4 stroke-[2]" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${contact.firstName}...`}
          className="flex-1 px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 focus:bg-white transition placeholder:text-stone-400 font-normal"
        />

        <button
          type="submit"
          disabled={(!inputText.trim() && !selectedMedia) || sending}
          className="p-2.5 bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:opacity-40 rounded-lg transition-all duration-150 flex items-center justify-center cursor-pointer shadow-xs"
          title="Send message"
        >
          <Send className="w-4 h-4 stroke-[2]" />
        </button>
      </form>
    </div>
  );
}
