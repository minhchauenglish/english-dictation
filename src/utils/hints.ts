/**
 * 3-Tier Progressive Hint System:
 * - Gợi ý 1: "💡 Từ đầu tiên là: XXXXX"
 * - Gợi ý 2: "💡 Từ khóa: XXXXX – XXXXX – XXXXX"
 * - Gợi ý 3: "💡 Khung câu: I ______ my ______ in the ______."
 */

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'ours', 'theirs',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'up', 'about', 'into',
  'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before',
  'under', 'around', 'among', 'and', 'but', 'or', 'so', 'because', 'as', 'until', 'while',
  'that', 'this', 'these', 'those', 'do', 'does', 'did', 'have', 'has', 'had', 'will',
  'would', 'can', 'could', 'should', 'may', 'might', 'must', 'there', 'here'
]);

/**
 * Splits sentence into English word tokens while stripping enclosing punctuation.
 * Preserves internal apostrophes (e.g. don't, I'm, o'clock, children's).
 */
export function extractSentenceWords(sentence: string): string[] {
  if (!sentence) return [];
  return sentence
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, ''))
    .filter(Boolean);
}

/**
 * Returns number of words in a sentence.
 */
export function getSentenceWordCount(sentence: string): number {
  return extractSentenceWords(sentence).length;
}

/**
 * Returns the first valid word token in a sentence (Level 1 hint).
 * Strips leading quotes/symbols if any.
 * Example: "\"Welcome to our classroom!\"" -> "Welcome"
 * Example: "My family is big." -> "My"
 */
export function getFirstWord(sentence: string): string {
  const words = extractSentenceWords(sentence);
  return words.length > 0 ? words[0] : '';
}

/**
 * Returns 1-3 content keywords from the sentence (Level 2 hint).
 * Prioritizes meaningful content words over common stopwords.
 * Never returns the entire sentence.
 */
export function getSentenceKeywords(sentence: string): string[] {
  const words = extractSentenceWords(sentence);
  if (words.length === 0) return [];
  if (words.length === 1) return [words[0]];

  // Filter for content words (exclude common functional stopwords)
  const contentWords = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));

  // Deduplicate case-insensitively while preserving original casing
  const uniqueContentWords: string[] = [];
  const seenLower = new Set<string>();
  for (const w of contentWords) {
    const lower = w.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      uniqueContentWords.push(w);
    }
  }

  let candidates = uniqueContentWords;

  // If sentence has mostly stopwords, fall back to non-first words or longer words
  if (candidates.length === 0) {
    candidates = words.slice(1);
    if (candidates.length === 0) candidates = words;
  }

  // Determine target keyword count (1 to 3 words, never the full sentence for >= 2 words)
  let targetCount = 2;
  if (words.length <= 2) {
    targetCount = 1;
  } else if (words.length >= 6 && candidates.length >= 3) {
    targetCount = 3;
  } else {
    targetCount = Math.min(candidates.length, 2);
  }

  // Select evenly distributed candidates across the sentence
  if (candidates.length <= targetCount) {
    return candidates;
  }

  if (targetCount === 1) {
    return [candidates[candidates.length - 1]];
  }

  if (targetCount === 2) {
    return [candidates[0], candidates[candidates.length - 1]];
  }

  const mid = Math.floor(candidates.length / 2);
  return [candidates[0], candidates[mid], candidates[candidates.length - 1]];
}

/**
 * Returns a word present in the sentence (for backwards compatibility).
 */
export function getAWordFromSentence(sentence: string): string {
  const keywords = getSentenceKeywords(sentence);
  if (keywords.length > 0) return keywords[0];
  const words = extractSentenceWords(sentence);
  return words.length > 0 ? words[0] : '';
}

/**
 * Generates a fill-in-the-blank sentence frame (Level 3 hint).
 * Replaces selected words with "______" while preserving punctuation and spacing.
 * - Short sentences (1-3 words): 1 blank.
 * - Medium sentences (4-6 words): 2 blanks.
 * - Long sentences (7-9 words): 3 blanks.
 * - Extra long sentences (10+ words): 3-4 blanks.
 * Does not reveal the entire sentence, and does not blank out all words when words > 1.
 */
export function generateSentenceFrame(sentence: string): string {
  if (!sentence) return '';

  // Find all word tokens and their positions
  const wordRegex = /[a-zA-Z0-9']+/g;
  interface WordToken {
    word: string;
    index: number;
    length: number;
  }

  const tokens: WordToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(sentence)) !== null) {
    tokens.push({
      word: match[0],
      index: match.index,
      length: match[0].length,
    });
  }

  if (tokens.length === 0) return sentence;

  if (tokens.length === 1) {
    // 1-word sentence: mask the single word
    const t = tokens[0];
    return sentence.slice(0, t.index) + '______' + sentence.slice(t.index + t.length);
  }

  // Determine number of blanks K
  let k = 2;
  if (tokens.length <= 3) {
    k = 1;
  } else if (tokens.length <= 6) {
    k = 2;
  } else if (tokens.length <= 9) {
    k = 3;
  } else {
    k = Math.min(4, Math.floor(tokens.length / 3));
  }

  // Pick indices to blank. Prefer content words that are NOT the first word (index > 0)
  // so the sentence structure starting word anchors the student.
  const indicesToBlank: number[] = [];

  const nonFirstIndices = tokens.map((_, i) => i).filter((i) => i > 0);
  const contentIndices = nonFirstIndices.filter(
    (i) => !STOP_WORDS.has(tokens[i].word.toLowerCase())
  );

  if (contentIndices.length >= k) {
    // Spread evenly across content indices
    const step = contentIndices.length / k;
    for (let i = 0; i < k; i++) {
      const pick = contentIndices[Math.floor(i * step + step / 2)] ?? contentIndices[i];
      if (!indicesToBlank.includes(pick)) {
        indicesToBlank.push(pick);
      }
    }
  }

  // If still need more blanks, fill from nonFirstIndices
  if (indicesToBlank.length < k) {
    for (const idx of nonFirstIndices.reverse()) {
      if (!indicesToBlank.includes(idx)) {
        indicesToBlank.push(idx);
        if (indicesToBlank.length >= k) break;
      }
    }
  }

  // Safety: Ensure at least one word is blanked and at least one is kept
  if (indicesToBlank.length === 0) {
    indicesToBlank.push(tokens.length - 1);
  }

  // Sort descending by index so string replacement offsets don't corrupt indices
  const blankSet = new Set(indicesToBlank);
  let result = sentence;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (blankSet.has(i)) {
      const t = tokens[i];
      result = result.slice(0, t.index) + '______' + result.slice(t.index + t.length);
    }
  }

  return result;
}

export interface ThreeTierHints {
  firstWord: string;
  keywords: string[];
  frame: string;
  level1Text: string;
  level2Text: string;
  level3Text: string;
}

export function generateThreeTierHints(sentence: string): ThreeTierHints {
  const firstWord = getFirstWord(sentence);
  const keywords = getSentenceKeywords(sentence);
  const frame = generateSentenceFrame(sentence);

  return {
    firstWord,
    keywords,
    frame,
    level1Text: `Từ đầu tiên là: ${firstWord}`,
    level2Text: `Từ khóa: ${keywords.join(' – ')}`,
    level3Text: `Khung câu:\n${frame}`,
  };
}
