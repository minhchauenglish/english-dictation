/**
 * Simple Hint Ladder helper functions.
 * Level 1: Word Count ("Câu này có X từ.")
 * Level 2: First-letter pattern with character masks ("I u______ g_ t_ s_____ b_ b__")
 */

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
 * Generates first letter masked hint for a sentence.
 * Examples:
 * - "I usually go to school by bus." -> "I u______ g_ t_ s_____ b_ b__"
 * - "I don't have breakfast at seven o'clock." -> "I d____ h___ b________ a_ s____ o______"
 */
export function generateFirstLetterHint(sentence: string): string {
  const words = extractSentenceWords(sentence);
  if (words.length === 0) return '';

  return words
    .map((word) => {
      if (word.length <= 1) return word;
      const firstChar = word.charAt(0);
      const underscores = '_'.repeat(word.length - 1);
      return `${firstChar}${underscores}`;
    })
    .join(' ');
}
