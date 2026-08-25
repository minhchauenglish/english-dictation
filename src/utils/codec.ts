import LZString from 'lz-string';
import { DictationExercise } from '../types';

interface MinifiedExercisePayload {
  t: string; // title
  s: string[]; // sentences
  v?: 'US' | 'UK'; // voice
  r?: number; // playback rate (0.75, 0.85, 1.0, 1.15)
  l?: number; // listen limit (0, 1, 2, 3)
  m?: 'EASY' | 'STRICT'; // checking mode
}

/**
 * Serializes and compresses a complete DictationExercise into a short URI-safe string.
 */
export function encodeExercise(exercise: DictationExercise): string {
  const minified: MinifiedExercisePayload = {
    t: exercise.title.trim(),
    s: exercise.sentences.map((s) => s.text.trim()).filter(Boolean),
    v: exercise.voiceAccent || 'US',
    r: exercise.playbackSpeed || 0.85,
    l: exercise.listenLimit ?? 3,
    m: exercise.checkMode || 'EASY',
  };

  const json = JSON.stringify(minified);
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * Decodes and inflates a compressed URI string into a full DictationExercise object.
 */
export function decodeExercise(encodedStr: string): DictationExercise | null {
  if (!encodedStr || !encodedStr.trim()) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(encodedStr.trim());
    if (!decompressed) {
      // Fallback: try raw JSON in case it was encoded without compression
      try {
        const rawJson = decodeURIComponent(encodedStr);
        const parsed = JSON.parse(rawJson);
        return parsePayload(parsed);
      } catch {
        return null;
      }
    }

    const parsed = JSON.parse(decompressed);
    return parsePayload(parsed);
  } catch (err) {
    console.error('Failed to decode exercise from string:', err);
    return null;
  }
}

function parsePayload(parsed: any): DictationExercise | null {
  if (!parsed) return null;

  // Handle minified payload: { t, s, v, r, l, m }
  if (typeof parsed.t === 'string' && Array.isArray(parsed.s)) {
    return {
      title: parsed.t || 'English Dictation',
      sentences: parsed.s.map((text: string, idx: number) => ({
        id: `s_${idx + 1}`,
        order: idx + 1,
        text: String(text).trim(),
      })),
      voiceAccent: parsed.v === 'UK' ? 'UK' : 'US',
      playbackSpeed: (parsed.r === 0.75 || parsed.r === 0.85 || parsed.r === 1.0 || parsed.r === 1.15) ? parsed.r : 0.85,
      listenLimit: (parsed.l === 0 || parsed.l === 1 || parsed.l === 2 || parsed.l === 3) ? parsed.l : 3,
      checkMode: parsed.m === 'STRICT' ? 'STRICT' : 'EASY',
    };
  }

  // Handle verbose payload: { title, sentences, voiceAccent, ... }
  if (typeof parsed.title === 'string' && Array.isArray(parsed.sentences)) {
    return {
      title: parsed.title || 'English Dictation',
      sentences: parsed.sentences.map((item: any, idx: number) => ({
        id: item.id || `s_${idx + 1}`,
        order: item.order || idx + 1,
        text: typeof item === 'string' ? item.trim() : (item.text || '').trim(),
      })),
      voiceAccent: parsed.voiceAccent === 'UK' ? 'UK' : 'US',
      playbackSpeed: parsed.playbackSpeed || 0.85,
      listenLimit: parsed.listenLimit ?? 3,
      checkMode: parsed.checkMode === 'STRICT' ? 'STRICT' : 'EASY',
    };
  }

  return null;
}

/**
 * Builds the full shareable URL containing the encoded exercise in the hash.
 * Preserves the exact host and repository subfolder path (e.g. https://username.github.io/english-dictation/)
 */
export function buildShareUrl(exercise: DictationExercise): string {
  const encoded = encodeExercise(exercise);
  if (typeof window === 'undefined') return `#/practice/${encoded}`;

  // Preserve the full path while stripping existing hash and query parameters
  const currentUrl = window.location.href.split('#')[0].split('?')[0];
  return `${currentUrl}#/practice/${encoded}`;
}

/**
 * Extracts encoded string from window.location.hash
 */
export function getEncodedExerciseFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (!hash) return null;

  // Match #/practice/<encoded> or #practice/<encoded>
  const practicePrefixMatch = hash.match(/#\/?practice\/(.+)$/);
  if (practicePrefixMatch && practicePrefixMatch[1]) {
    return practicePrefixMatch[1].split('?')[0].trim();
  }

  // Fallback match #<encoded>
  const rawMatch = hash.replace(/^#\/?/, '').split('?')[0].trim();
  if (rawMatch && rawMatch !== 'practice' && !rawMatch.startsWith('practice/')) {
    return rawMatch;
  }

  return null;
}
