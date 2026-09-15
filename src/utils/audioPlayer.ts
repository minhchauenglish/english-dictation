import { VoiceAccent, VoiceMode, VoicePitch, PlaybackSpeed } from '../types';

export const PREVIEW_SENTENCE = "Hello! Listen carefully and type what you hear.";

export const STORAGE_KEY_VOICE_ACCENT = 'dictation_preferred_voice_accent';
export const STORAGE_KEY_VOICE_URI = 'dictation_selected_voice_uri';
export const STORAGE_KEY_PLAYBACK_SPEED = 'dictation_preferred_speed';

let cachedVoices: SpeechSynthesisVoice[] = [];
const voiceListeners: Set<(voices: SpeechSynthesisVoice[]) => void> = new Set();

/**
 * Filter list to only English voices (en-US, en-GB, en-AU, en-CA, en-IE, etc.)
 */
export function filterEnglishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    return lang.startsWith('en-') || lang === 'en' || (v.name && /english|en-/i.test(v.name));
  });
}

/**
 * Scores an English voice based on naturalness indicators and target accent.
 * Gives strong weight to:
 * - en-US / en-GB locale matching
 * - natural, enhanced, premium, neural, female keywords
 * - high-clarity voice providers (Google, Microsoft, Apple, Siri)
 */
export function scoreVoice(voice: SpeechSynthesisVoice, targetAccent: 'US' | 'UK' = 'US'): number {
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase().replace('_', '-');

  // Must be English
  if (!lang.startsWith('en') && !name.includes('english') && !name.includes('en-')) {
    return -1000;
  }

  let score = 0;

  // Strict Accent match vs related fallbacks
  if (targetAccent === 'US') {
    if (lang === 'en-us' || name.includes('united states') || name.includes('us english') || name.includes('american')) {
      score += 200;
    } else if (lang.startsWith('en-ca')) {
      score += 80;
    } else if (lang.startsWith('en-')) {
      score += 40;
    }
  } else if (targetAccent === 'UK') {
    if (lang === 'en-gb' || name.includes('united kingdom') || name.includes('uk english') || name.includes('british')) {
      score += 200;
    } else if (lang.startsWith('en-ie') || lang.startsWith('en-au') || lang.startsWith('en-nz')) {
      score += 80;
    } else if (lang.startsWith('en-')) {
      score += 40;
    }
  }

  // Keywords explicitly requested: natural, neural, enhanced, premium, female
  if (name.includes('natural')) score += 150;
  if (name.includes('neural')) score += 150;
  if (name.includes('enhanced')) score += 120;
  if (name.includes('premium')) score += 100;
  if (name.includes('female') || name.includes('woman')) score += 50;

  // High quality natural personas
  const highQualityNames = [
    'aria', 'jenny', 'samantha', 'serena', 'victoria', 'karen', 'ava',
    'allison', 'kate', 'daniel', 'guy', 'oliver', 'george', 'serena', 'steffi'
  ];
  for (const p of highQualityNames) {
    if (name.includes(p)) {
      score += 40;
      break;
    }
  }

  if (name.includes('online')) score += 60;
  if (name.includes('google') || name.includes('microsoft') || name.includes('apple') || name.includes('siri')) {
    score += 35;
  }

  if (voice.default) {
    score += 5;
  }

  return score;
}

/**
 * Returns available English voices, ranked with best quality first for the given accent.
 */
export function getRankedEnglishVoices(targetAccent: 'US' | 'UK' = 'US'): SpeechSynthesisVoice[] {
  const englishVoices = filterEnglishVoices(getVoicesSnapshot());
  return [...englishVoices].sort((a, b) => scoreVoice(b, targetAccent) - scoreVoice(a, targetAccent));
}

/**
 * Returns the best available natural voice for US or UK accent.
 * Implements fallback: target accent -> other accent -> any English voice -> any voice -> null.
 */
export function getBestVoiceForAccent(targetAccent: 'US' | 'UK' = 'US'): SpeechSynthesisVoice | null {
  const voices = getVoicesSnapshot();
  if (voices.length === 0) return null;

  const englishVoices = filterEnglishVoices(voices);
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // 1. Filter by target accent
  const targetMatches = pool.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    if (targetAccent === 'US') {
      return lang === 'en-us' || name.includes('united states') || name.includes('us') || name.includes('american');
    } else {
      return lang === 'en-gb' || name.includes('united kingdom') || name.includes('uk') || name.includes('british');
    }
  });

  if (targetMatches.length > 0) {
    return [...targetMatches].sort((a, b) => scoreVoice(b, targetAccent) - scoreVoice(a, targetAccent))[0];
  }

  // 2. Fallback to alternative accent
  const altAccent: 'US' | 'UK' = targetAccent === 'US' ? 'UK' : 'US';
  const altMatches = pool.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    if (altAccent === 'US') {
      return lang === 'en-us' || name.includes('united states') || name.includes('us');
    } else {
      return lang === 'en-gb' || name.includes('united kingdom') || name.includes('uk');
    }
  });

  if (altMatches.length > 0) {
    return [...altMatches].sort((a, b) => scoreVoice(b, altAccent) - scoreVoice(a, altAccent))[0];
  }

  // 3. Fallback to best English voice overall
  const ranked = getRankedEnglishVoices(targetAccent);
  if (ranked.length > 0) return ranked[0];

  // 4. Fallback to any voice available on device
  return pool[0] || null;
}

/**
 * Resolves the appropriate SpeechSynthesisVoice given exercise/user preferences.
 * Implements cross-device fallback.
 */
export interface ResolveVoiceOptions {
  voiceMode?: VoiceMode;
  preferredVoiceName?: string;
  preferredVoiceURI?: string;
  preferredLang?: string;
  accent?: VoiceAccent;
  customVoice?: SpeechSynthesisVoice | null;
}

export function resolveVoice(options: ResolveVoiceOptions): SpeechSynthesisVoice | null {
  const {
    preferredVoiceName,
    preferredVoiceURI,
    preferredLang,
    accent = 'US',
    customVoice,
  } = options;

  if (customVoice) return customVoice;

  const voices = getVoicesSnapshot();
  if (voices.length === 0) return null;

  // 1. If a specific voice URI was requested
  if (preferredVoiceURI) {
    const matchUri = voices.find((v) => v.voiceURI === preferredVoiceURI);
    if (matchUri) return matchUri;
  }

  // 2. If a specific voice name was requested
  if (preferredVoiceName) {
    const matchName = voices.find(
      (v) => v.name.toLowerCase() === preferredVoiceName.toLowerCase()
    );
    if (matchName) return matchName;

    const partialName = voices.find((v) =>
      v.name.toLowerCase().includes(preferredVoiceName.toLowerCase())
    );
    if (partialName) return partialName;
  }

  // 3. Match by preferred language
  if (preferredLang) {
    const langMatch = filterEnglishVoices(voices).filter(
      (v) => v.lang.toLowerCase() === preferredLang.toLowerCase()
    );
    if (langMatch.length > 0) {
      return [...langMatch].sort((a, b) => scoreVoice(b, accent) - scoreVoice(a, accent))[0];
    }
  }

  // 4. Resolve best natural voice for the target accent (US or UK)
  return getBestVoiceForAccent(accent);
}

/**
 * LocalStorage helpers for audio settings.
 */
export function getStoredVoiceAccent(): 'US' | 'UK' {
  if (typeof window === 'undefined') return 'US';
  try {
    const val = localStorage.getItem(STORAGE_KEY_VOICE_ACCENT);
    if (val === 'UK') return 'UK';
    return 'US';
  } catch {
    return 'US';
  }
}

export function setStoredVoiceAccent(accent: 'US' | 'UK'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_VOICE_ACCENT, accent);
  } catch (e) {
    console.warn('Failed to save voice accent to localStorage', e);
  }
}

export function getStoredPlaybackSpeed(): number {
  if (typeof window === 'undefined') return 0.9;
  try {
    const val = localStorage.getItem(STORAGE_KEY_PLAYBACK_SPEED);
    if (val) {
      const num = parseFloat(val);
      if ([0.75, 0.9, 1.0].includes(num)) return num;
    }
    return 0.9;
  } catch {
    return 0.9;
  }
}

export function setStoredPlaybackSpeed(speed: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PLAYBACK_SPEED, speed.toString());
  } catch (e) {
    console.warn('Failed to save speed to localStorage', e);
  }
}

export function getStoredVoiceURI(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY_VOICE_URI) || '';
  } catch {
    return '';
  }
}

export function setStoredVoiceURI(uri: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_VOICE_URI, uri);
  } catch (e) {
    console.warn('Failed to save voice URI to localStorage', e);
  }
}

/**
 * Returns synchronous snapshot of voices.
 */
export function getVoicesSnapshot(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices;
}

/**
 * Subscribe to browser voice changes (fires when Chrome / OS loads voices asynchronously).
 */
export function subscribeToVoices(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
  voiceListeners.add(callback);
  callback(getVoicesSnapshot());
  return () => {
    voiceListeners.delete(callback);
  };
}

function updateVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const current = window.speechSynthesis.getVoices();
  if (current.length > 0) {
    cachedVoices = current;
    voiceListeners.forEach((listener) => {
      try {
        listener(cachedVoices);
      } catch (e) {
        console.warn('Voice listener error:', e);
      }
    });
  }
}

// Initial setup with robust listener + polling fallback
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  updateVoices();
  window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
  window.speechSynthesis.onvoiceschanged = updateVoices;

  // Staggered polling for slow browser voice initialization (Chrome / Safari / Android)
  const pollIntervals = [50, 150, 300, 600, 1200, 2000];
  pollIntervals.forEach((delay) => {
    setTimeout(updateVoices, delay);
  });
}

export interface AudioPlaybackOptions {
  text: string;
  voice?: SpeechSynthesisVoice | null;
  voiceMode?: VoiceMode;
  preferredVoiceName?: string;
  preferredVoiceURI?: string;
  preferredLang?: string;
  accent?: VoiceAccent;
  speed?: number; // 0.75, 0.9, 1.0
  pitch?: number; // default 1.0
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
    this.playInternal(options, false);
  }

  private playInternal(
    options: AudioPlaybackOptions,
    isRetry: boolean,
    failedVoiceURI?: string
  ): void {
    const {
      text,
      voice: explicitVoice,
      preferredVoiceName,
      preferredVoiceURI,
      preferredLang,
      accent = 'US',
      speed = 0.9,
      pitch = 1.0,
      onStart,
      onEnd,
      onError,
    } = options;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.(
        new Error(
          'Thiết bị này chưa hỗ trợ giọng đọc. Vui lòng mở bằng Chrome hoặc Edge.'
        )
      );
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2.0, speed));
      utterance.pitch = Math.max(0.8, Math.min(1.3, pitch));
      utterance.volume = 1;

      let chosenVoice: SpeechSynthesisVoice | null = null;

      if (!isRetry) {
        chosenVoice =
          explicitVoice ||
          resolveVoice({
            preferredVoiceName,
            preferredVoiceURI,
            preferredLang,
            accent,
          });
      } else {
        // Fallback: choose the best alternative English voice on device
        const ranked = getRankedEnglishVoices(accent);
        chosenVoice = ranked.find((v) => v.voiceURI !== failedVoiceURI) || ranked[0] || null;
      }

      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang || (accent === 'UK' ? 'en-GB' : 'en-US');
      } else {
        utterance.lang = accent === 'UK' ? 'en-GB' : 'en-US';
      }

      const activeVoiceURI = chosenVoice?.voiceURI;

      utterance.onstart = () => {
        onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        onEnd?.();
      };

      utterance.onerror = (event) => {
        // Ignore user-initiated cancellation/interruptions
        if (event.error === 'interrupted' || event.error === 'canceled') {
          this.currentUtterance = null;
          onEnd?.();
          return;
        }

        console.warn('SpeechSynthesis playback failed:', event);

        if (!isRetry) {
          // Attempt retry ONCE with best fallback voice
          setTimeout(() => {
            this.playInternal(options, true, activeVoiceURI);
          }, 60);
          return;
        }

        // Both original and fallback attempts failed
        this.currentUtterance = null;
        onError?.(
          new Error(
            'Thiết bị này chưa hỗ trợ giọng đọc. Vui lòng mở bằng Chrome hoặc Edge.'
          )
        );
        onEnd?.();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('SpeechSynthesis invocation error:', e);
      if (!isRetry) {
        setTimeout(() => {
          this.playInternal(options, true);
        }, 60);
        return;
      }
      this.currentUtterance = null;
      onError?.(
        new Error(
          'Thiết bị này chưa hỗ trợ giọng đọc. Vui lòng mở bằng Chrome hoặc Edge.'
        )
      );
      onEnd?.();
    }
  }
}

export const audioPlayer = new AudioPlayer();
