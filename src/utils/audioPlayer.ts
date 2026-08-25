import { VoiceAccent, VoiceMode, VoicePitch, PlaybackSpeed } from '../types';

export const PREVIEW_SENTENCE = "Hello! Listen carefully and type what you hear.";

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
 * Scores an English voice based on naturalness indicators and preferred accent.
 */
export function scoreVoice(voice: SpeechSynthesisVoice, targetAccent?: 'US' | 'UK'): number {
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase().replace('_', '-');

  // Must be English
  if (!lang.startsWith('en') && !name.includes('english')) {
    return -1000;
  }

  let score = 0;

  // High quality keywords
  if (name.includes('natural')) score += 120;
  if (name.includes('neural')) score += 120;
  if (name.includes('online')) score += 90;
  if (name.includes('premium')) score += 80;
  if (name.includes('enhanced')) score += 75;
  if (name.includes('google')) score += 60;
  if (name.includes('microsoft')) score += 50;
  if (name.includes('siri') || name.includes('apple')) score += 50;

  // Known clean voice persona names
  const popularVoices = ['aria', 'jenny', 'guy', 'samantha', 'daniel', 'serena', 'alex', 'karen', 'oliver', 'kate', 'george', 'victoria', 'ava', 'allison', 'tom', 'steffi'];
  for (const p of popularVoices) {
    if (name.includes(p)) {
      score += 30;
      break;
    }
  }

  // Accent weighting
  if (targetAccent === 'US') {
    if (lang === 'en-us' || name.includes('united states') || name.includes('us english') || name.includes('american')) {
      score += 40;
    } else if (lang.startsWith('en-ca')) {
      score += 20; // Closely related
    }
  } else if (targetAccent === 'UK') {
    if (lang === 'en-gb' || name.includes('united kingdom') || name.includes('uk english') || name.includes('british')) {
      score += 40;
    } else if (lang.startsWith('en-ie') || lang.startsWith('en-au')) {
      score += 20;
    }
  } else {
    // For general natural voice, slight preference for standard en-US / en-GB
    if (lang === 'en-us' || lang === 'en-gb') {
      score += 15;
    }
  }

  if (voice.default) {
    score += 5;
  }

  return score;
}

/**
 * Returns available English voices, ranked with best quality first.
 */
export function getRankedEnglishVoices(targetAccent?: 'US' | 'UK'): SpeechSynthesisVoice[] {
  const englishVoices = filterEnglishVoices(getVoicesSnapshot());
  return [...englishVoices].sort((a, b) => scoreVoice(b, targetAccent) - scoreVoice(a, targetAccent));
}

/**
 * Returns the single best natural English voice available on the device.
 */
export function getBestNaturalVoice(targetAccent?: 'US' | 'UK'): SpeechSynthesisVoice | null {
  const ranked = getRankedEnglishVoices(targetAccent);
  if (ranked.length > 0) return ranked[0];

  const all = getVoicesSnapshot();
  return all.find((v) => (v.lang || '').toLowerCase().startsWith('en')) || all[0] || null;
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
    voiceMode = 'NATURAL',
    preferredVoiceName,
    preferredVoiceURI,
    preferredLang,
    accent = 'US',
    customVoice,
  } = options;

  if (customVoice) return customVoice;

  const voices = getVoicesSnapshot();
  if (voices.length === 0) return null;

  const englishVoices = filterEnglishVoices(voices);
  const voicePool = englishVoices.length > 0 ? englishVoices : voices;

  // 1. If a specific voice name or URI was requested
  if (voiceMode === 'CUSTOM' || preferredVoiceName || preferredVoiceURI) {
    if (preferredVoiceURI) {
      const matchUri = voicePool.find((v) => v.voiceURI === preferredVoiceURI);
      if (matchUri) return matchUri;
    }
    if (preferredVoiceName) {
      const matchName = voicePool.find(
        (v) => v.name.toLowerCase() === preferredVoiceName.toLowerCase()
      );
      if (matchName) return matchName;

      // Partial name match
      const partialName = voicePool.find((v) =>
        v.name.toLowerCase().includes(preferredVoiceName.toLowerCase())
      );
      if (partialName) return partialName;
    }

    // Fallback: match by preferred language
    if (preferredLang) {
      const langMatch = voicePool.filter(
        (v) => v.lang.toLowerCase() === preferredLang.toLowerCase()
      );
      if (langMatch.length > 0) {
        return [...langMatch].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
      }
    }
  }

  // 2. Mode US
  if (voiceMode === 'US' || accent === 'US') {
    const usVoices = voicePool.filter((v) => {
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      return l === 'en-us' || v.name.toLowerCase().includes('us');
    });
    if (usVoices.length > 0) {
      return [...usVoices].sort((a, b) => scoreVoice(b, 'US') - scoreVoice(a, 'US'))[0];
    }
  }

  // 3. Mode UK
  if (voiceMode === 'UK' || accent === 'UK') {
    const ukVoices = voicePool.filter((v) => {
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      return l === 'en-gb' || v.name.toLowerCase().includes('uk') || v.name.toLowerCase().includes('british');
    });
    if (ukVoices.length > 0) {
      return [...ukVoices].sort((a, b) => scoreVoice(b, 'UK') - scoreVoice(a, 'UK'))[0];
    }
  }

  // 4. Mode NATURAL (or fallback)
  return getBestNaturalVoice(voiceMode === 'UK' ? 'UK' : voiceMode === 'US' ? 'US' : undefined);
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
  speed?: number; // 0.75, 0.85, 0.9, 0.95, 1.0, 1.15
  pitch?: number; // 0.9, 1.0, 1.05, 1.1
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
      voiceMode = 'NATURAL',
      preferredVoiceName,
      preferredVoiceURI,
      preferredLang,
      accent = 'US',
      speed = 0.95,
      pitch = 1.0,
      onStart,
      onEnd,
      onError,
    } = options;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.(new Error('Không thể phát giọng đọc trên thiết bị này. Hãy thử chọn một giọng khác trong ÂM THANH.'));
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
            voiceMode,
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
            'Không thể phát giọng đọc trên thiết bị này. Hãy thử chọn một giọng khác trong ÂM THANH.'
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
          'Không thể phát giọng đọc trên thiết bị này. Hãy thử chọn một giọng khác trong ÂM THANH.'
        )
      );
      onEnd?.();
    }
  }
}

export const audioPlayer = new AudioPlayer();
