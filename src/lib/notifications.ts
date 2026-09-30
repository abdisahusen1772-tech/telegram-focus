/**
 * Distraction-Free Notification Service
 * 
 * STRICT PRIVACY GUARANTEE:
 * Message text, media, snippets, and previews are NEVER passed to notifications.
 * Only sender identification or channel title is displayed:
 * - "New message from Ahmed"
 * - "New post in Study Channel"
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Play a calm, tranquil two-tone chime via Web Audio API
 */
export function playCalmChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First tone (G4 - 392Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(392.00, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.85);

    // Second harmonic tone (C5 - 523.25Hz) after brief pause
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.06, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 1.25);
  } catch (e) {
    console.debug('Audio chime unable to play:', e);
  }
}

/**
 * Trigger a contact notification with STRICTLY HIDDEN PREVIEW
 */
export function notifyContactMessage(contactName: string, soundEnabled = true): void {
  if (soundEnabled) {
    playCalmChime();
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(`New message from ${contactName}`, {
      body: 'Open Focus to view message',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      silent: true, // We handled the calm chime
    });
  }
}

/**
 * Trigger a channel post notification with STRICTLY HIDDEN PREVIEW
 */
export function notifyChannelPost(channelTitle: string, soundEnabled = true): void {
  if (soundEnabled) {
    playCalmChime();
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(`New post in ${channelTitle}`, {
      body: 'Open Focus to view post',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      silent: true,
    });
  }
}
