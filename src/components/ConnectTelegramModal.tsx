'use client';

import React, { useState } from 'react';
import { Smartphone, KeyRound, Lock, AlertCircle, Loader2, Sparkles, CheckCircle, Info } from 'lucide-react';

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
        body: JSON.stringify({ phoneNumber: cleanPhone }),
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
          setError(data.error || 'Two-Factor Authentication is enabled. Please enter your password.');
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
        throw new Error(data.error || 'Failed to activate demo mode');
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
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-md rounded-lg shadow-xl p-6 text-stone-900">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-semibold tracking-wide text-stone-900">
              Connect Telegram Account
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 text-sm font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Telegram API config state pill */}
        <div className="mt-3 mb-2 p-2.5 bg-stone-100 border border-stone-200 rounded text-xs">
          <div className="flex items-center space-x-1.5 text-stone-700">
            <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span className="font-medium">
              {isApiConfigured
                ? 'Telegram MTProto API: Active'
                : 'Telegram MTProto API: Ready for credentials'}
            </span>
          </div>
          {!isApiConfigured && (
            <p className="mt-1 text-[11px] text-stone-500 leading-tight">
              To use your real Telegram account, add <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">TELEGRAM_API_ID</code> & <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">TELEGRAM_API_HASH</code> to <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">.env.local</code> (obtained free from my.telegram.org).
            </p>
          )}
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendCode} className="mt-4 space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed">
              Authenticate securely using your phone number via Telegram&apos;s official MTProto protocol. No passwords are requested upfront.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
                Phone Number (with Country Code)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded font-mono focus:outline-none focus:border-stone-800 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Sending Code...' : 'Send Telegram Code'}</span>
            </button>

            <div className="pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={handleDemoActivate}
                disabled={loading}
                className="w-full py-2 text-xs font-medium text-stone-700 bg-stone-200 hover:bg-stone-300 rounded transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-stone-600" />
                <span>Quick Test: Try Distraction-Free Sandbox</span>
              </button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed">
              Enter the verification code sent to your Telegram account or via SMS.
            </p>

            {statusNote && (
              <div className="p-2.5 bg-stone-100 border border-stone-200 rounded text-stone-700 text-xs flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                <span>{statusNote}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
                Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded font-mono tracking-widest text-center focus:outline-none focus:border-stone-800 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="py-2.5 px-3 text-xs font-medium text-stone-600 bg-stone-200 hover:bg-stone-300 rounded transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Verifying...' : 'Authenticate'}</span>
              </button>
            </div>
          </form>
        )}

        {step === '2fa' && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed">
              Two-Factor Authentication is active on this Telegram account. Enter your Telegram 2FA cloud password to complete sign-in.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-stone-600 mb-1">
                2FA Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="password"
                  value={password2FA}
                  onChange={(e) => setPassword2FA(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded font-mono focus:outline-none focus:border-stone-800 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStep('code')}
                className="py-2.5 px-3 text-xs font-medium text-stone-600 bg-stone-200 hover:bg-stone-300 rounded transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !password2FA.trim()}
                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-50 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Authenticating...' : 'Confirm 2FA'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
