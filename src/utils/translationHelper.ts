/**
 * Utility for parsing and retrieving Vietnamese translations for sentences and lessons.
 */

export interface SentenceTranslationResult {
  sentenceTranslation: string; // The translation for the specific sentence index
  fullTranslation: string; // The entire lesson translation
  hasTranslation: boolean;
}

/**
 * Extracts the clean translation for a given sentence index (0-based) from the lesson translation text.
 */
export function getSentenceTranslation(
  rawTranslation?: string,
  sentenceIndex: number = 0,
  totalSentences: number = 1
): SentenceTranslationResult {
  if (!rawTranslation || !rawTranslation.trim()) {
    return {
      sentenceTranslation: '',
      fullTranslation: '',
      hasTranslation: false,
    };
  }

  const full = rawTranslation.trim();
  const rawLines = full
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return {
      sentenceTranslation: '',
      fullTranslation: '',
      hasTranslation: false,
    };
  }

  // Check if lines are explicitly numbered (e.g., "1. Đây là...", "2. Tôi yêu...")
  const targetNum = sentenceIndex + 1;
  const numberedRegex = new RegExp(`^${targetNum}[.)]\\s*(.+)`, 'i');
  for (const line of rawLines) {
    const match = line.match(numberedRegex);
    if (match) {
      return {
        sentenceTranslation: match[1].trim(),
        fullTranslation: full,
        hasTranslation: true,
      };
    }
  }

  // If number of lines matches the total sentence count, map 1-to-1
  if (rawLines.length === totalSentences && sentenceIndex < rawLines.length) {
    const cleanLine = rawLines[sentenceIndex]
      .replace(/^[0-9]+[.)]\s*/, '')
      .replace(/^[-*•–—]\s*/, '')
      .trim();
    return {
      sentenceTranslation: cleanLine,
      fullTranslation: full,
      hasTranslation: true,
    };
  }

  // If lines are fewer or single paragraph, return the full paragraph as the translation context
  return {
    sentenceTranslation: full,
    fullTranslation: full,
    hasTranslation: true,
  };
}
