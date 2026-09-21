import LZString from 'lz-string';
import { DictationExercise, PlaybackSpeed, VoiceMode, VoicePitch } from '../types';

interface MinifiedExercisePayload {
  t: string; // title
  s: string[]; // sentences
  tr?: string; // translation (Vietnamese)
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
 * Omits standard default values to minimize payload size and shortCode length.
 */
export function encodeExercise(exercise: DictationExercise): string {
  const isTest = exercise.exerciseMode === 'TEST';
  const voiceAccent = exercise.voiceAccent || 'US';
  const voiceMode = exercise.voiceMode || (voiceAccent === 'UK' ? 'UK' : 'NATURAL');
  const pitch = exercise.pitch ?? 1.0;
  const speed = exercise.playbackSpeed || 0.95;
  const checkMode = exercise.checkMode || 'EASY';

  const minified: MinifiedExercisePayload = {
    t: exercise.title.trim(),
    s: exercise.sentences.map((s) => s.text.trim()).filter(Boolean),
  };

  // Only include optional/non-default fields if set
  if (exercise.translation && exercise.translation.trim()) {
    minified.tr = exercise.translation.trim();
  }
  if (isTest) {
    minified.em = 'test';
  }
  if (voiceAccent !== 'US') {
    minified.v = voiceAccent;
  }
  if (voiceMode !== 'NATURAL') {
    minified.vm = voiceMode;
  }
  if (exercise.preferredVoiceName) {
    minified.vn = exercise.preferredVoiceName;
  }
  if (exercise.preferredVoiceURI) {
    minified.vu = exercise.preferredVoiceURI;
  }
  if (exercise.preferredLang) {
    minified.vl = exercise.preferredLang;
  }
  if (pitch !== 1.0) {
    minified.p = pitch;
  }
  if (speed !== 0.95) {
    minified.r = speed;
  }
  if (checkMode !== 'EASY') {
    minified.m = checkMode;
  }

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
      translation: parsed.tr ? String(parsed.tr).trim() : undefined,
      exerciseMode,
      voiceMode,
      voiceAccent: parsed.v === 'UK' ? 'UK' : 'US',
      preferredVoiceName: parsed.vn || undefined,
      preferredVoiceURI: parsed.vu || undefined,
      preferredLang: parsed.vl || undefined,
      pitch,
      playbackSpeed: speed,
      listenLimit: 0,
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
      translation: parsed.translation ? String(parsed.translation).trim() : (parsed.tr ? String(parsed.tr).trim() : undefined),
      exerciseMode: parsed.exerciseMode === 'TEST' ? 'TEST' : 'PRACTICE',
      voiceMode: parsed.voiceMode || (parsed.voiceAccent === 'UK' ? 'UK' : 'NATURAL'),
      voiceAccent: parsed.voiceAccent === 'UK' ? 'UK' : 'US',
      preferredVoiceName: parsed.preferredVoiceName,
      preferredVoiceURI: parsed.preferredVoiceURI,
      preferredLang: parsed.preferredLang,
      pitch: VALID_PITCHES.includes(parsed.pitch) ? parsed.pitch : 1.0,
      playbackSpeed: VALID_SPEEDS.includes(parsed.playbackSpeed) ? parsed.playbackSpeed : 0.95,
      listenLimit: 0,
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
 * Builds the modern short shareable URL containing the optimized encoded exercise in the hash.
 * Output format: https://minhchauenglish.github.io/english-dictation/#/p/<shortCode>
 */
export function buildShareUrl(exercise: DictationExercise): string {
  const encoded = encodeExercise(exercise);
  return `${GITHUB_PAGES_BASE_URL}#/p/${encoded}`;
}

/**
 * Extracts encoded exercise string from window.location.hash
 * Supports:
 * - Modern short route: #/p/<shortCode> or #p/<shortCode>
 * - Legacy route: #/practice/<encoded> or #practice/<encoded>
 * - Direct hash fallback: #<encoded>
 */
export function getEncodedExerciseFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (!hash) return null;

  // 1. Modern short route: #/p/<shortCode> or #p/<shortCode>
  const shortPrefixMatch = hash.match(/#\/?p\/([^?&]+)/);
  if (shortPrefixMatch && shortPrefixMatch[1]) {
    return shortPrefixMatch[1].trim();
  }

  // 2. Legacy full route: #/practice/<encoded> or #practice/<encoded>
  const practicePrefixMatch = hash.match(/#\/?practice\/([^?&]+)/);
  if (practicePrefixMatch && practicePrefixMatch[1]) {
    return practicePrefixMatch[1].trim();
  }

  // 3. Fallback match #<encoded> (excluding internal routes)
  const rawMatch = hash.replace(/^#\/?/, '').split('?')[0].trim();
  if (
    rawMatch &&
    rawMatch !== 'practice' &&
    rawMatch !== 'p' &&
    !rawMatch.startsWith('practice/') &&
    !rawMatch.startsWith('p/')
  ) {
    return rawMatch;
  }

  return null;
}
