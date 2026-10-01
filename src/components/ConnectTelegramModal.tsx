'use client';

import React, { useState } from 'react';
import { Smartphone, KeyRound, Lock, AlertCircle, Loader2, Sparkles, CheckCircle, Info, ExternalLink, Key } from 'lucide-react';

interface ConnectTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
  isApiConfigured: boolean;
}

export function ConnectTelegramModal({
  isOpen,
  onClose,
  onConnected,
  isApiConfigured,
}: ConnectTelegramModalProps) {
  const [step, setStep] = useState<'phone' | 'code' | '2fa'>('phone');
  const [phone, setPhone] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [showApiFields, setShowApiFields] = useState(!isApiConfigured);
  const [code, setCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;

    setLoading(true);
    setError(null);
    setStatusNote(null);

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          apiId: apiId.trim() || undefined,
          apiHash: apiHash.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send Telegram code');
      }

      setPhoneCodeHash(data.phoneCodeHash);
      setStatusNote(data.message || 'Verification code sent to your Telegram app / SMS');
      setStep('code');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !phoneCodeHash) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          phoneCode: code.trim(),
          phoneCodeHash,
          password: password2FA.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needs2FA) {
          setStep('2fa');
          setError(data.error || 'Two-Factor Authentication is enabled. Please enter your 2FA password.');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Invalid verification code');
      }

      onConnected();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoActivate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo-login', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to activate sandbox');
      }
      onConnected();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate sandbox';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-md rounded-2xl shadow-2xl p-6 text-stone-900 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-semibold tracking-wide text-stone-900">
              Connect Your Telegram Account
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 text-sm font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Telegram API Status Info */}
        <div className="mt-3 mb-2 p-3 bg-stone-100 border border-stone-200 rounded-xl text-xs space-y-1">
          <div className="flex items-center justify-between text-stone-800">
            <div className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="font-semibold">Official MTProto Authentication</span>
            </div>
            <a
              href="https://my.telegram.org"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-blue-600 hover:underline flex items-center space-x-0.5"
            >
              <span>my.telegram.org</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-[11px] text-stone-500 leading-relaxed font-sans">
            Connects securely using Telegram&apos;s native protocol. Once connected, your messages send and arrive in real-time.
          </p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendCode} className="mt-4 space-y-4">
            {/* Optional API ID & Hash form */}
            <div>
              <button
                type="button"
                onClick={() => setShowApiFields(!showApiFields)}
                className="text-[11px] font-mono text-stone-600 hover:text-stone-900 flex items-center space-x-1 cursor-pointer mb-2"
              >
                <Key className="w-3 h-3 text-stone-500" />
                <span>{showApiFields ? 'Hide API credentials' : 'Enter my.telegram.org API credentials (optional)'}</span>
              </button>

              {showApiFields && (
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-2.5 mb-3">
                  <p className="text-[10px] text-stone-500 font-sans">
                    Get your free credentials in 1 minute from <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-blue-600 underline">my.telegram.org</a> $\to$ API development tools:
                  </p>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                      API ID (App api_id)
                    </label>
                    <input
                      type="text"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      placeholder="e.g. 12345678"
                      className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded font-mono focus:outline-none focus:border-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                      API Hash (App api_hash)
                    </label>
                    <input
                      type="text"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      placeholder="e.g. 0123456789abcdef0123456789abcdef"
                      className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded font-mono focus:outline-none focus:border-stone-800"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
                Your Telegram Phone Number
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-stone-300 rounded-lg font-mono focus:outline-none focus:border-stone-800 transition"
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-1 font-mono">
                Include country code (e.g. +1, +44, +971, +90, +966)
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Requesting Telegram Code...' : 'Send Telegram Code'}</span>
            </button>

            <div className="pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={handleDemoActivate}
                disabled={loading}
                className="w-full py-2 text-xs font-medium text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-stone-600" />
                <span>Test Drive in Sandbox Mode</span>
              </button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed font-sans">
              Enter the 5-digit verification code sent to your Telegram app or via SMS.
            </p>

            {statusNote && (
              <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-lg text-stone-700 text-xs flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                <span>{statusNote}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
                Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-base bg-white border border-stone-300 rounded-lg font-mono tracking-widest text-center focus:outline-none focus:border-stone-800 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="py-2.5 px-3 text-xs font-medium text-stone-600 bg-stone-200 hover:bg-stone-300 rounded-lg transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Verifying...' : 'Connect Account'}</span>
              </button>
            </div>
          </form>
        )}

        {step === '2fa' && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed font-sans">
              Two-Factor Authentication is active on your Telegram account. Enter your Telegram 2FA cloud password to complete sign-in.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
                Telegram 2FA Cloud Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="password"
                  value={password2FA}
                  onChange={(e) => setPassword2FA(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-stone-300 rounded-lg font-mono focus:outline-none focus:border-stone-800 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStep('code')}
                className="py-2.5 px-3 text-xs font-medium text-stone-600 bg-stone-200 hover:bg-stone-300 rounded-lg transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !password2FA.trim()}
                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Authenticating...' : 'Confirm 2FA Password'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
