import { CheckMode, WordDiffItem } from '../types';

// Common English abbreviations to protect during sentence splitting
const ABBREVIATIONS = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'vs', 'etc',
  'eg', 'e.g', 'ie', 'i.e', 'am', 'a.m', 'pm', 'p.m',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
  'No', 'Vol', 'Dept', 'Univ', 'Inc', 'Ltd', 'Co', 'Corp', 'Ave', 'Blvd', 'Rd'
];

/**
 * Splits a pasted English passage into individual clean sentences.
 * Correctly protects abbreviations, decimals, and clean quotation marks.
 */
export function splitPassageIntoSentences(passage: string): string[] {
  if (!passage || !passage.trim()) return [];

  // Normalize newlines
  let cleaned = passage.replace(/\r\n/g, '\n').trim();

  // Temporarily protect common abbreviations
  ABBREVIATIONS.forEach((abbr) => {
    const regex = new RegExp(`\\b(${abbr})\\.(\\s*)`, 'gi');
    cleaned = cleaned.replace(regex, '$1___DOT___$2');
  });

  // Protect decimal numbers e.g. 3.14 or 10.5
  cleaned = cleaned.replace(/(\d+)\.(\d+)/g, '$1___DOT___$2');

  // Split on sentence-ending punctuation (. ? !) or lines
  const rawSentences = cleaned
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.replace(/___DOT___/g, '.').trim())
    .filter((s) => s.length > 0);

  return rawSentences;
}

/**
 * Normalizes quotes, apostrophes, and dashes to standard ASCII characters.
 * Handles smart quotes (’, ‘, `, “, ”) and hyphens.
 */
export function normalizeText(str: string): string {
  return str
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'") // smart single quotes to standard '
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes to standard "
    .replace(/[\u2013\u2014]/g, '-') // en/em dash to standard -
    .replace(/\s+/g, ' ') // multiple spaces to single space
    .trim();
}

/**
 * Tokenizes sentence according to check mode.
 * - EASY (DỄ): ignores punctuation and case, preserves contractions (e.g. don't, doesn't, isn't, I'm, it's, we're, o'clock).
 * - STRICT (CHÍNH XÁC): checks case and punctuation exactly.
 */
export function tokenizeSentence(sentence: string, mode: CheckMode = 'EASY'): string[] {
  const clean = normalizeText(sentence);

  if (mode === 'EASY') {
    // Strip punctuation except internal apostrophes and alphanumeric characters
    const withoutPunctuation = clean.replace(/[^a-zA-Z0-9'\s]/g, ' ');
    const tokens = withoutPunctuation
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    return tokens;
  }

  // STRICT mode: tokens include words and punctuation as separate units, exact case
  const rawTokens = clean.match(/[a-zA-Z0-9']+|[.,!?;:"()]/g) || [];
  return rawTokens.map((t) => t.trim()).filter((t) => t.length > 0);
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Performs word-level alignment comparison between student answer and target sentence.
 * 100% client-side JavaScript execution.
 */
export function compareSentenceAnswers(
  targetSentence: string,
  studentSentence: string,
  mode: CheckMode = 'EASY'
): {
  isCorrect: boolean;
  sentenceAccuracy: number;
  wordDiffs: WordDiffItem[];
  wrongWords: string[];
} {
  const targetTokens = tokenizeSentence(targetSentence, mode);
  const studentTokens = tokenizeSentence(studentSentence, mode);

  // If student answer is empty
  if (studentTokens.length === 0) {
    const wordDiffs: WordDiffItem[] = targetTokens.map((w) => ({
      type: 'missing',
      correctWord: w,
      explanation: `Thiếu từ: "${w}"`,
    }));

    return {
      isCorrect: false,
      sentenceAccuracy: 0,
      wordDiffs,
      wrongWords: targetTokens.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, '')).filter(Boolean),
    };
  }

  // Needleman-Wunsch Alignment Matrix
  const n = targetTokens.length;
  const m = studentTokens.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i * 2;
  for (let j = 0; j <= m; j++) dp[0][j] = j * 2;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const tWord = targetTokens[i - 1];
      const sWord = studentTokens[j - 1];

      let matchCost = 0;
      if (tWord === sWord) {
        matchCost = 0;
      } else {
        const lev = levenshteinDistance(tWord, sWord);
        const maxLen = Math.max(tWord.length, sWord.length);
        if (lev <= 2 && lev / maxLen <= 0.4) {
          matchCost = 1; // minor typo
        } else {
          matchCost = 2; // different word
        }
      }

      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + matchCost, // substitution/match
        dp[i - 1][j] + 2, // deletion (missing from target)
        dp[i][j - 1] + 2 // insertion (extra student word)
      );
    }
  }

  // Backtracking
  let i = n;
  let j = m;
  const alignedOps: { type: 'correct' | 'incorrect' | 'missing' | 'extra'; target?: string; student?: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const tWord = targetTokens[i - 1];
      const sWord = studentTokens[j - 1];
      let matchCost = 0;
      if (tWord === sWord) {
        matchCost = 0;
      } else {
        const lev = levenshteinDistance(tWord, sWord);
        const maxLen = Math.max(tWord.length, sWord.length);
        matchCost = lev <= 2 && lev / maxLen <= 0.4 ? 1 : 2;
      }

      if (dp[i][j] === dp[i - 1][j - 1] + matchCost) {
        if (matchCost === 0) {
          alignedOps.unshift({ type: 'correct', target: tWord, student: sWord });
        } else {
          alignedOps.unshift({ type: 'incorrect', target: tWord, student: sWord });
        }
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 2) {
      alignedOps.unshift({ type: 'missing', target: targetTokens[i - 1] });
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 2) {
      alignedOps.unshift({ type: 'extra', student: studentTokens[j - 1] });
      j--;
    } else {
      if (i > 0) {
        alignedOps.unshift({ type: 'missing', target: targetTokens[i - 1] });
        i--;
      } else if (j > 0) {
        alignedOps.unshift({ type: 'extra', student: studentTokens[j - 1] });
        j--;
      }
    }
  }

  let correctCount = 0;
  let incorrectCount = 0;
  let missingCount = 0;
  let extraCount = 0;

  const wordDiffs: WordDiffItem[] = [];
  const wrongWordsSet = new Set<string>();

  for (const op of alignedOps) {
    if (op.type === 'correct') {
      correctCount++;
      wordDiffs.push({
        type: 'correct',
        studentWord: op.student,
        correctWord: op.target,
      });
    } else if (op.type === 'incorrect') {
      incorrectCount++;
      wordDiffs.push({
        type: 'incorrect',
        studentWord: op.student,
        correctWord: op.target,
        explanation: `"${op.student}" → "${op.target}"`,
      });
      if (op.target) {
        const cleanWord = op.target.toLowerCase().replace(/[^a-z0-9']/g, '');
        if (cleanWord.length > 1) wrongWordsSet.add(cleanWord);
      }
    } else if (op.type === 'missing') {
      missingCount++;
      wordDiffs.push({
        type: 'missing',
        correctWord: op.target,
        explanation: `Thiếu từ "${op.target}"`,
      });
      if (op.target) {
        const cleanWord = op.target.toLowerCase().replace(/[^a-z0-9']/g, '');
        if (cleanWord.length > 1) wrongWordsSet.add(cleanWord);
      }
    } else if (op.type === 'extra') {
      extraCount++;
      wordDiffs.push({
        type: 'extra',
        studentWord: op.student,
        explanation: `Thừa từ "${op.student}"`,
      });
    }
  }

  const isCorrect = incorrectCount === 0 && missingCount === 0 && extraCount === 0;
  const targetTotal = Math.max(1, targetTokens.length);
  const rawAccuracy = (correctCount / targetTotal) * 100 - extraCount * 10;
  const sentenceAccuracy = Math.max(0, Math.min(100, Math.round(rawAccuracy)));

  return {
    isCorrect,
    sentenceAccuracy,
    wordDiffs,
    wrongWords: Array.from(wrongWordsSet),
  };
}
