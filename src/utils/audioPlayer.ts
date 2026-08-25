import { VoiceAccent } from '../types';

let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Loads and caches available speech synthesis voices from the browser.
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const available = window.speechSynthesis.getVoices();
    if (available.length > 0) {
      cachedVoices = available;
      resolve(available);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };

    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 400);
  });
}

// Initial load
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
}

/**
 * Selects an English voice matching the requested accent (US / UK).
 * Automatically falls back to any available English voice on the device.
 */
export function getVoiceForAccent(accent: VoiceAccent = 'US'): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }

  const langCode = accent === 'UK' ? 'en-GB' : 'en-US';

  // 1. Exact match
  const exact = cachedVoices.find((v) => v.lang === langCode || v.lang.replace('_', '-') === langCode);
  if (exact) return exact;

  // 2. Prefix match (e.g. en-US, en_US, en-GB, en_GB)
  const partial = cachedVoices.find((v) =>
    v.lang.toLowerCase().startsWith(accent === 'UK' ? 'en-gb' : 'en-us')
  );
  if (partial) return partial;

  // 3. Any English voice
  const anyEnglish = cachedVoices.find((v) => v.lang.toLowerCase().startsWith('en'));
  if (anyEnglish) return anyEnglish;

  // 4. Default system voice
  return cachedVoices[0] || null;
}

export interface AudioPlaybackOptions {
  text: string;
  accent?: VoiceAccent;
  speed?: number; // 0.75, 0.85, 1.0, 1.15
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

class AudioPlayer {
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  public play(options: AudioPlaybackOptions): void {
    this.stop();

    const { text, accent = 'US', speed = 0.85, onStart, onEnd, onError } = options;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.(new Error('Trình duyệt không hỗ trợ Web Speech Synthesis.'));
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2.0, speed));
      utterance.pitch = 1.0;
      utterance.lang = accent === 'UK' ? 'en-GB' : 'en-US';

      const voice = getVoiceForAccent(accent);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        onEnd?.();
      };

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          console.warn('SpeechSynthesis error:', event);
          onError?.(event);
        }
        this.currentUtterance = null;
        onEnd?.();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('SpeechSynthesis invocation error:', e);
      onError?.(e);
    }
  }
}

export const audioPlayer = new AudioPlayer();
