import LZString from 'lz-string';
import { DictationExercise, PlaybackSpeed, VoiceMode, VoicePitch } from '../types';

interface MinifiedExercisePayload {
  t: string; // title
  s: string[]; // sentences
  em?: 'practice' | 'test'; // exercise mode ('practice' | 'test')
  v?: 'US' | 'UK'; // fallback voice accent
  vm?: VoiceMode; // voice mode ('NATURAL' | 'US' | 'UK' | 'CUSTOM')
  vn?: string; // preferred voice name
  vu?: string; // preferred voice URI
  vl?: string; // preferred lang
  p?: VoicePitch; // pitch (0.9, 1.0, 1.05, 1.1)
  r?: number; // playback rate (0.75, 0.85, 0.9, 0.95, 1.0, 1.15)
  l?: number; // listen limit (0, 1, 2, 3)
  m?: 'EASY' | 'STRICT'; // checking mode
}

const VALID_SPEEDS: PlaybackSpeed[] = [0.75, 0.85, 0.9, 0.95, 1.0, 1.15];
const VALID_PITCHES: VoicePitch[] = [0.9, 1.0, 1.05, 1.1];

/**
 * Serializes and compresses a complete DictationExercise into a short URI-safe string.
 */
export function encodeExercise(exercise: DictationExercise): string {
  const minified: MinifiedExercisePayload = {
    t: exercise.title.trim(),
    s: exercise.sentences.map((s) => s.text.trim()).filter(Boolean),
    em: exercise.exerciseMode === 'TEST' ? 'test' : 'practice',
    v: exercise.voiceAccent || 'US',
    vm: exercise.voiceMode || 'NATURAL',
    vn: exercise.preferredVoiceName,
    vu: exercise.preferredVoiceURI,
    vl: exercise.preferredLang,
    p: exercise.pitch ?? 1.0,
    r: exercise.playbackSpeed || 0.95,
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

  // Handle minified payload: { t, s, em, v, vm, vn, vu, vl, p, r, l, m }
  if (typeof parsed.t === 'string' && Array.isArray(parsed.s)) {
    const speed = VALID_SPEEDS.includes(parsed.r) ? parsed.r : 0.95;
    const pitch = VALID_PITCHES.includes(parsed.p) ? parsed.p : 1.0;
    const voiceMode: VoiceMode =
      parsed.vm === 'NATURAL' || parsed.vm === 'US' || parsed.vm === 'UK' || parsed.vm === 'CUSTOM'
        ? parsed.vm
        : parsed.v === 'UK'
        ? 'UK'
        : 'NATURAL';

    const exerciseMode = parsed.em === 'test' ? 'TEST' : 'PRACTICE';

    return {
      title: parsed.t || 'English Dictation',
      sentences: parsed.s.map((text: string, idx: number) => ({
        id: `s_${idx + 1}`,
        order: idx + 1,
        text: String(text).trim(),
      })),
      exerciseMode,
      voiceMode,
      voiceAccent: parsed.v === 'UK' ? 'UK' : 'US',
      preferredVoiceName: parsed.vn || undefined,
      preferredVoiceURI: parsed.vu || undefined,
      preferredLang: parsed.vl || undefined,
      pitch,
      playbackSpeed: speed,
      listenLimit: (parsed.l === 0 || parsed.l === 1 || parsed.l === 2 || parsed.l === 3) ? parsed.l : 3,
      checkMode: parsed.m === 'STRICT' ? 'STRICT' : 'EASY',
    };
  }

  // Handle verbose payload: { title, sentences, exerciseMode, voiceAccent, ... }
  if (typeof parsed.title === 'string' && Array.isArray(parsed.sentences)) {
    return {
      title: parsed.title || 'English Dictation',
      sentences: parsed.sentences.map((item: any, idx: number) => ({
        id: item.id || `s_${idx + 1}`,
        order: item.order || idx + 1,
        text: typeof item === 'string' ? item.trim() : (item.text || '').trim(),
      })),
      exerciseMode: parsed.exerciseMode === 'TEST' ? 'TEST' : 'PRACTICE',
      voiceMode: parsed.voiceMode || (parsed.voiceAccent === 'UK' ? 'UK' : 'NATURAL'),
      voiceAccent: parsed.voiceAccent === 'UK' ? 'UK' : 'US',
      preferredVoiceName: parsed.preferredVoiceName,
      preferredVoiceURI: parsed.preferredVoiceURI,
      preferredLang: parsed.preferredLang,
      pitch: VALID_PITCHES.includes(parsed.pitch) ? parsed.pitch : 1.0,
      playbackSpeed: VALID_SPEEDS.includes(parsed.playbackSpeed) ? parsed.playbackSpeed : 0.95,
      listenLimit: parsed.listenLimit ?? 3,
      checkMode: parsed.checkMode === 'STRICT' ? 'STRICT' : 'EASY',
    };
  }

  return null;
}

/**
 * Canonical GitHub Pages base URL for students.
 * All student links generated across the app strictly use this URL.
 */
export const GITHUB_PAGES_BASE_URL = 'https://minhchauenglish.github.io/english-dictation/';

/**
 * Builds the full shareable URL containing the encoded exercise in the hash.
 * Output format: https://minhchauenglish.github.io/english-dictation/#/practice/<encoded>
 */
export function buildShareUrl(exercise: DictationExercise): string {
  const encoded = encodeExercise(exercise);
  return `${GITHUB_PAGES_BASE_URL}#/practice/${encoded}`;
}

/**
 * Extracts encoded string from window.location.hash
 */
export function getEncodedExerciseFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (!hash) return null;

  // Match #/practice/<encoded> or #practice/<encoded> with optional query params
  const practicePrefixMatch = hash.match(/#\/?practice\/([^?&]+)/);
  if (practicePrefixMatch && practicePrefixMatch[1]) {
    return practicePrefixMatch[1].trim();
  }

  // Fallback match #<encoded> (excluding internal routes)
  const rawMatch = hash.replace(/^#\/?/, '').split('?')[0].trim();
  if (rawMatch && rawMatch !== 'practice' && !rawMatch.startsWith('practice/')) {
    return rawMatch;
  }

  return null;
}
