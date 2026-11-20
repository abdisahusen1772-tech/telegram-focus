'use client';

import React, { useState, useRef } from 'react';
import { Camera, X, Upload, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenConnectModal?: () => void;
}

export function StoryModal({ isOpen, onClose, onSuccess, onOpenConnectModal }: StoryModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP)');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
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
    const localApiId = localStorage.getItem('tg_api_id');
    const localApiHash = localStorage.getItem('tg_api_hash');
    if (localApiId) headers['x-telegram-api-id'] = localApiId;
    if (localApiHash) headers['x-telegram-api-hash'] = localApiHash;
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

  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/telegram/story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          media: selectedImage,
          caption: caption.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to post story to Telegram');
      }

      setSuccess('Story posted to your Telegram profile successfully!');
      setTimeout(() => {
        setSelectedImage(null);
        setCaption('');
        setSuccess(null);
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error posting story';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-sm rounded-2xl shadow-2xl p-5 text-stone-900 flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Camera className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-semibold tracking-wide text-stone-900">
              Post Telegram Story
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 text-sm font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs space-y-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {(error.toLowerCase().includes('connect') || error.toLowerCase().includes('reconnect')) && onOpenConnectModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConnectModal();
                }}
                className="w-full py-1.5 px-3 bg-red-700 hover:bg-red-800 text-white text-xs font-medium rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>Connect Telegram Account →</span>
              </button>
            )}
          </div>
        )}

        {success && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handlePostStory} className="mt-4 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedImage ? (
            <div className="relative rounded-xl overflow-hidden border border-stone-300 bg-black max-h-72 flex items-center justify-center">
              <img
                src={selectedImage}
                alt="Story preview"
                className="max-h-72 w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 hover:border-stone-500 rounded-2xl p-6 text-center cursor-pointer transition bg-white/60 hover:bg-white"
            >
              <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-2 text-stone-600">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-stone-800">
                Select Photo from Gallery or Camera
              </p>
              <p className="text-[10px] text-stone-500 font-mono mt-1">
                JPG, PNG, WebP up to 15MB
              </p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-stone-600 mb-1">
              Story Caption (Optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening?"
              maxLength={200}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-stone-500 font-sans"
            />
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-mono transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedImage || loading}
              className={`flex-1 py-2.5 rounded-xl text-xs font-mono tracking-wide transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                !selectedImage || loading
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : 'bg-stone-900 text-white hover:bg-stone-800 shadow-md'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Post Story</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
