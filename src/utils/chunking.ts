/**
 * Utility for breaking long English sentences into natural, educational chunks
 * for students during dictation listening.
 *
 * Rules:
 * - Preserves all words in exact order
 * - Never drops or alters words
 * - Prefers punctuation (commas, semicolons), conjunctions, and prepositional boundaries
 * - Avoids splitting inside noun phrases, verb phrases, articles, or fixed idioms
 * - Short sentences (1-8 words) remain 1 chunk
 * - Medium sentences (9-14 words) become ~2 chunks
 * - Long sentences (15+ words) become ~3-5 chunks
 */

export interface SentenceChunk {
  index: number; // 0-based index: 0, 1, 2...
  total: number; // total chunks count
  text: string; // The chunk text to be spoken and displayed
}

// Fixed idioms and multi-word prepositions that must NEVER be split inside
const FIXED_MULTIWORD_PHRASES = [
  'a lot of',
  'lots of',
  'in front of',
  'next to',
  'as soon as',
  'one of the',
  'at the moment',
  'in order to',
  'as well as',
  'according to',
  'because of',
  'instead of',
  'out of',
  'each other',
  'one another',
  'for example',
  'such as',
  'more than',
  'less than',
  'at least',
  'at most',
  'in the morning',
  'in the afternoon',
  'in the evening',
  'at night',
  'on the weekend',
  'on weekends',
  'look at',
  'listen to',
  'wait for',
];

// Articles, possessives, and demonstratives that must NOT be separated from following word
const DETERMINERS = new Set([
  'a',
  'an',
  'the',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'every',
  'each',
  'some',
  'any',
  'no',
]);

// Auxiliary & modal verbs that should not be detached from an immediately following main verb
const AUXILIARY_VERBS = new Set([
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
]);

// Conjunctions & clause starters
const CONJUNCTIONS = new Set([
  'and',
  'but',
  'or',
  'so',
  'yet',
  'for',
  'because',
  'although',
  'though',
  'even',
  'while',
  'when',
  'whenever',
  'if',
  'unless',
  'since',
  'as',
  'after',
  'before',
  'until',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'why',
  'how',
  'that',
]);

// Common prepositions that form natural phrase heads
const PREPOSITIONS = new Set([
  'in',
  'on',
  'at',
  'for',
  'with',
  'without',
  'from',
  'to',
  'by',
  'about',
  'into',
  'through',
  'under',
  'over',
  'between',
  'among',
  'during',
  'before',
  'after',
]);

interface WordToken {
  raw: string; // token with trailing punctuation
  word: string; // cleaned lowercase word
  hasCommaOrSemi: boolean;
  hasPunctuationEnd: boolean;
  charStart: number;
  charEnd: number;
}

/**
 * Tokenizes a sentence while tracking character offsets in the original string.
 */
function tokenizeSentence(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9']/g, '');
    const hasCommaOrSemi = /[,;:—–]$/.test(raw);
    const hasPunctuationEnd = /[.!?]$/.test(raw);

    tokens.push({
      raw,
      word: cleaned,
      hasCommaOrSemi,
      hasPunctuationEnd,
      charStart: match.index,
      charEnd: match.index + raw.length,
    });
  }

  return tokens;
}

/**
 * Checks if a split between token[i] and token[i+1] would occur inside a fixed multiword phrase.
 */
function isInsideFixedPhrase(tokens: WordToken[], splitAfterIdx: number): boolean {
  // Check windows of 2 to 4 tokens surrounding splitAfterIdx
  const lowerWords = tokens.map((t) => t.word);
  for (const phrase of FIXED_MULTIWORD_PHRASES) {
    const phraseWords = phrase.split(' ');
    const phraseLen = phraseWords.length;

    for (let start = Math.max(0, splitAfterIdx - phraseLen + 1); start <= splitAfterIdx; start++) {
      if (start + phraseLen <= lowerWords.length) {
        let matches = true;
        for (let k = 0; k < phraseLen; k++) {
          if (lowerWords[start + k] !== phraseWords[k]) {
            matches = false;
            break;
          }
        }
        if (matches && splitAfterIdx >= start && splitAfterIdx < start + phraseLen - 1) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Scores a potential split point after token index `i` (meaning chunk 1 ends at token `i`, chunk 2 starts at token `i+1`).
 */
function evaluateSplitCandidate(
  tokens: WordToken[],
  i: number,
  targetChunkWordCount: number,
  lastSplitIdx: number,
  totalTokens: number
): number {
  if (i < 0 || i >= totalTokens - 1) return -9999;

  const currentToken = tokens[i];
  const nextToken = tokens[i + 1];

  const currentWord = currentToken.word;
  const nextWord = nextToken.word;

  // Words since last split point
  const wordsInCurrentChunk = i - lastSplitIdx;
  // Words remaining after this split point
  const wordsRemaining = totalTokens - 1 - i;

  // Hard constraints:
  // 1. Avoid creating tiny chunks < 2 words
  if (wordsInCurrentChunk < 2 || wordsRemaining < 2) {
    return -9999;
  }

  // 2. Determiners: Never split immediately after 'a', 'the', 'my', etc.
  if (DETERMINERS.has(currentWord)) {
    return -9999;
  }

  // 3. 'to' followed by verb (infinitive): e.g. "to play", "to have"
  if (currentWord === 'to') {
    return -9999;
  }

  // 4. Auxiliary verb followed by main verb: e.g. "is playing", "have done"
  if (AUXILIARY_VERBS.has(currentWord)) {
    // If auxiliary is not preceded by a gerund clause subject, penalty
    if (wordsInCurrentChunk < 3) {
      return -9999;
    }
  }

  // 5. Fixed multi-word phrases: "in front of", "next to", etc.
  if (isInsideFixedPhrase(tokens, i)) {
    return -9999;
  }

  // Base score calculation based on linguistic cues:
  let score = 0;

  // 1. Strongest boundary: Punctuation (comma, semicolon, colon, dash)
  if (currentToken.hasCommaOrSemi) {
    score += 50;
  }

  // 2. Conjunctions at the start of the next chunk (e.g. "but playing...", "and everyone...")
  if (CONJUNCTIONS.has(nextWord)) {
    score += 35;
  }

  // 3. Prepositions at the start of next chunk (e.g. "in her bedroom", "for my family")
  if (PREPOSITIONS.has(nextWord)) {
    score += 20;
  }

  // 4. Main copula / verb onset following a long subject phrase (e.g. "is usually more fun")
  if (
    (nextWord === 'is' || nextWord === 'are' || nextWord === 'was' || nextWord === 'were') &&
    wordsInCurrentChunk >= 3
  ) {
    score += 25;
  }

  // 5. Ideal chunk length proximity score (penalize deviation from targetChunkWordCount)
  const lengthDeviation = Math.abs(wordsInCurrentChunk - targetChunkWordCount);
  score -= lengthDeviation * 4;

  // Bonus for balanced remaining length
  if (wordsInCurrentChunk >= 3 && wordsRemaining >= 3) {
    score += 10;
  }

  return score;
}

/**
 * Splits a long English sentence into natural, short educational chunks.
 *
 * Guaranteed invariants:
 * 1. Chunks in sequence contain ALL original words without deletion or rearrangement.
 * 2. If sentence has <= 8 words, returns 1 chunk.
 * 3. If sentence has 9-14 words, returns ~2 chunks.
 * 4. If sentence has > 14 words, returns ~3-5 chunks.
 */
export function splitSentenceIntoChunks(sentenceText: string): SentenceChunk[] {
  const trimmed = sentenceText.trim();
  if (!trimmed) return [];

  const tokens = tokenizeSentence(trimmed);
  const totalWords = tokens.length;

  // Rule: 1-8 words -> single full sentence chunk
  if (totalWords <= 8) {
    return [
      {
        index: 0,
        total: 1,
        text: trimmed,
      },
    ];
  }

  // Determine desired chunk count target
  let desiredChunks = 2;
  if (totalWords >= 22) {
    desiredChunks = 4;
  } else if (totalWords >= 14) {
    desiredChunks = 3;
  }

  const targetWordsPerChunk = Math.round(totalWords / desiredChunks);

  // Greedily find optimal split points
  const splitIndices: number[] = []; // token indices after which a split occurs
  let lastSplitIdx = -1;

  while (splitIndices.length < desiredChunks - 1) {
    let bestIdx = -1;
    let bestScore = -9990;

    // Search window for the next split point around targetWordsPerChunk
    const minSearchIdx = lastSplitIdx + 2;
    const maxSearchIdx = totalTokensValidBound(tokens, totalWords);

    for (let candidateIdx = minSearchIdx; candidateIdx <= maxSearchIdx; candidateIdx++) {
      const score = evaluateSplitCandidate(
        tokens,
        candidateIdx,
        targetWordsPerChunk,
        lastSplitIdx,
        totalWords
      );

      if (score > bestScore) {
        bestScore = score;
        bestIdx = candidateIdx;
      }
    }

    // If no good split point found, break
    if (bestIdx === -1 || bestScore < -500) {
      break;
    }

    splitIndices.push(bestIdx);
    lastSplitIdx = bestIdx;
  }

  // Fallback: If no split was chosen (e.g. odd sentence structure) but sentence > 8 words,
  // split at midpoint avoiding determiners
  if (splitIndices.length === 0 && totalWords > 8) {
    const mid = Math.floor(totalWords / 2) - 1;
    for (let offset = 0; offset <= 3; offset++) {
      for (const candidate of [mid - offset, mid + offset]) {
        if (
          candidate >= 2 &&
          candidate <= totalWords - 3 &&
          !DETERMINERS.has(tokens[candidate].word) &&
          !isInsideFixedPhrase(tokens, candidate)
        ) {
          splitIndices.push(candidate);
          break;
        }
      }
      if (splitIndices.length > 0) break;
    }
  }

  // Construct chunk substrings using exact token character offsets to preserve all text
  const chunksText: string[] = [];
  let chunkStartChar = 0;

  for (let s = 0; s < splitIndices.length; s++) {
    const splitTokenIdx = splitIndices[s];
    const chunkEndChar = tokens[splitTokenIdx].charEnd;
    const chunkSubstr = trimmed.slice(chunkStartChar, chunkEndChar).trim();
    if (chunkSubstr) {
      chunksText.push(chunkSubstr);
    }
    // Next chunk starts at next token
    if (splitTokenIdx + 1 < tokens.length) {
      chunkStartChar = tokens[splitTokenIdx + 1].charStart;
    }
  }

  // Final chunk
  const finalSubstr = trimmed.slice(chunkStartChar).trim();
  if (finalSubstr) {
    chunksText.push(finalSubstr);
  }

  // Return chunk objects
  return chunksText.map((text, idx) => ({
    index: idx,
    total: chunksText.length,
    text,
  }));
}

function totalTokensValidBound(tokens: WordToken[], totalWords: number): number {
  return totalWords - 3;
}
