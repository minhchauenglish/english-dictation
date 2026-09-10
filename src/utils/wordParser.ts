import mammothModule from 'mammoth';
import { ImportedLesson, ImportFileResult, LessonContentType } from '../types/import';
import { DictationExercise, DictationSentence } from '../types';

// Safely get mammoth instance whether ESM or CJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammoth: any = (mammothModule as any)?.default || mammothModule;

/**
 * Standard error message when no lessons are detected.
 */
export const FORMAT_ERROR_GUIDE_TEXT = `Không tìm thấy bài học.

Vui lòng kiểm tra file Word có ít nhất:
LESSON: 1
TITLE: Tên bài
CONTENT:
Nội dung bài học (từ vựng hoặc câu)`;

/**
 * Extracts raw text from a .docx file ArrayBuffer in the browser.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (typeof mammoth?.extractRawText === 'function') {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || '';
    }
    throw new Error('Word extractor engine is not available.');
  } catch (err: unknown) {
    console.error('Error extracting docx text:', err);
    throw new Error('Unable to read this Word file. Please check the file and try again.');
  }
}

/**
 * Normalizes type string to supported LessonContentType enum.
 * Supports English and Vietnamese type labels.
 */
function normalizeLessonType(rawType: string): LessonContentType {
  const t = rawType.toUpperCase().trim();
  if (
    (t.includes('WORD') && t.includes('SENTENCE')) ||
    (t.includes('TỪ') && t.includes('CÂU')) ||
    (t.includes('TU') && t.includes('CAU'))
  ) {
    return 'WORDS_AND_SENTENCES';
  }
  if (t.includes('PARAGRAPH') || t.includes('ĐOẠN') || t.includes('DOAN')) {
    return 'PARAGRAPH';
  }
  if (t.includes('SENTENCE') || t.includes('CÂU') || t.includes('CAU')) {
    return 'SENTENCES';
  }
  if (t.includes('WORD') || t.includes('TỪ') || t.includes('TU')) {
    return 'WORDS';
  }
  if (t.includes('MIXED') || t.includes('KẾT HỢP') || t.includes('HON HOP')) {
    return 'MIXED';
  }
  return 'SENTENCES';
}

/**
 * Splits paragraph into individual sentences by punctuation (. ! ?) or line breaks.
 */
export function splitParagraphIntoSentences(text: string): string[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: string[] = [];
  for (const line of lines) {
    const matches = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    if (matches && matches.length > 1) {
      matches.forEach((m) => {
        const trimmed = m.trim();
        if (trimmed.length > 0) result.push(trimmed);
      });
    } else {
      result.push(line);
    }
  }

  return result;
}

export const LESSON_HEADER_REGEX =
  /^\s*(?:LESSON|BÀI|BAI|UNIT)\s*(?::\s*|\s+)(\d+[a-zA-Z]?)(?:\s*[:\-–—.]\s*|\s+|$)(.*)$/i;

/**
 * Checks if a string contains instructional/guide phrases rather than actual lesson content or titles.
 */
export function isInstructionText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('dùng content') ||
    lower.includes('dung content') ||
    lower.includes('dùng words') ||
    lower.includes('dung words') ||
    lower.includes('dùng sentences') ||
    lower.includes('dung sentences') ||
    lower.includes('phải có') ||
    lower.includes('phai co') ||
    lower.includes('cần có') ||
    lower.includes('can co') ||
    lower.includes('hướng dẫn') ||
    lower.includes('huong dan') ||
    lower.includes('lưu ý') ||
    lower.includes('luu y') ||
    lower.includes('soạn bài') ||
    lower.includes('soan bai') ||
    lower.includes('quy tắc') ||
    lower.includes('quy tac') ||
    lower.includes('format guide') ||
    lower.includes('template guide') ||
    lower.includes('instructions') ||
    lower.includes('instruction') ||
    lower.includes('mẫu bài') ||
    lower.includes('mau bai') ||
    lower.includes('nội dung mẫu') ||
    lower.includes('noi dung mau') ||
    lower.includes('và title') ||
    lower.includes('va title') ||
    lower.includes('và content') ||
    lower.includes('va content') ||
    lower.includes('dùng thay thế') ||
    lower.includes('dung thay the') ||
    lower.includes('đơn giản dùng') ||
    lower.includes('don gian dung') ||
    lower.includes('bài học cần') ||
    lower.includes('bai hoc can')
  );
}

/**
 * Helper to check if a line is an ignorable separator or keyword artifact.
 */
function isIgnorableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // Separator lines (e.g. "==================", "------------------", "**********")
  if (/^[=\-_*~#]{3,}$/.test(trimmed)) {
    return true;
  }

  // Guide or notes section headers
  if (
    /^(?:HƯỚNG DẪN|HUONG DAN|LƯU Ý|LUU Y|GHI CHÚ|GHI CHU|NOTE|NOTES|GUIDE|INSTRUCTION|INSTRUCTIONS)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Standalone section headers that should never be in content
  if (
    /^(?:WORDS?|SENTENCES?|CONTENT|PARAGRAPH|TYPE|CLASS|GRADE|TITLE|TỪ|TỪ VỰNG|TU VUNG|CÂU|CAU|NỘI DUNG|NOI DUNG|ĐOẠN VĂN|DOAN VAN|LOẠI|LOẠI BÀI|LỚP|LOP|KHỐI|KHOI|TIÊU ĐỀ|TIEU DE|TÊN BÀI|TEN BAI)\s*[:\-]?$/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Accidental lesson header line (valid header)
  if (LESSON_HEADER_REGEX.test(trimmed)) {
    return true;
  }

  // Lines that are instruction sentences
  if (isInstructionText(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Cleans individual word or sentence text items:
 * Strips numbering bullets like "1. ", "1) ", bullet dashes "- ", "• "
 * and accidental header prefixes.
 */
function cleanTextItem(text: string): string {
  return text
    .replace(
      /^(?:WORDS?|SENTENCES?|CONTENT|PARAGRAPH|TỪ VỰNG|CÂU|NỘI DUNG)\s*[:\-]\s*/i,
      ''
    )
    .replace(/^[0-9]+[.)]\s*/, '') // e.g. "1. apple" -> "apple"
    .replace(/^[-*•–—]\s*/, '') // e.g. "- apple" -> "apple"
    .trim();
}

/**
 * Parses the raw lesson header string (e.g. from "LESSON 1: MY FAMILY" or "BÀI 1 - MY FAMILY")
 * Extracts lessonNumber and optional inlineTitle.
 */
export function parseLessonHeaderLine(rawHeader: string): {
  lessonNumber: string;
  inlineTitle?: string;
} {
  const match = rawHeader.trim().match(LESSON_HEADER_REGEX);
  if (match) {
    const num = match[1].trim();
    let inlineTitle = match[2]
      ? match[2].replace(/^[:\-–—.]+\s*/, '').replace(/[:\-–—.]+$/, '').trim()
      : undefined;
    if (!inlineTitle || isInstructionText(inlineTitle)) {
      inlineTitle = undefined;
    }
    return {
      lessonNumber: num,
      inlineTitle,
    };
  }

  return {
    lessonNumber: '',
    inlineTitle: undefined,
  };
}

/**
 * Parses raw text extracted from a Word (.docx) file into structured lessons.
 * Supports:
 * - LESSON:, LESSON 1, Lesson 1, lesson 1
 * - BÀI 1, BÀI 1:, Bài 1, Bài 1:
 * - UNIT 1, UNIT 1:, Unit 1, Unit 1:
 * - LESSON 1: MY FAMILY, LESSON 1 - MY FAMILY, BÀI 1: MY FAMILY, UNIT 1: MY FAMILY
 * - Automatic Title detection when TITLE: is omitted.
 */
export function parseWordContent(
  rawText: string,
  fileName: string,
  fileId: string
): ImportFileResult {
  const errors: string[] = [];
  const lines = rawText.split(/\r?\n/);

  let detectedClass: string | undefined;
  let detectedGrade: string | undefined;

  // 1. Scan for file-level headers (CLASS:, GRADE:, LỚP:, KHỐI:)
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    if (!detectedClass) {
      const classMatch = line.match(/^(?:CLASS|LỚP|LOP):\s*(.+)$/i);
      if (classMatch && classMatch[1]) {
        detectedClass = classMatch[1].trim();
      }
    }
    if (!detectedGrade) {
      const gradeMatch = line.match(/^(?:GRADE|KHỐI|KHOI):\s*(.+)$/i);
      if (gradeMatch && gradeMatch[1]) {
        detectedGrade = gradeMatch[1].trim();
      }
    }
  }

  // 2. Identify start index of each lesson
  // Matches "LESSON: 1", "LESSON 1", "Lesson 1:", "LESSON 1: MY FAMILY", "BÀI 1", "Bài 1:", "UNIT 1", "Unit 1: My School"
  const lessonStartIndices: {
    index: number;
    lessonNumber: string;
    inlineTitle?: string;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // If an instruction/guide section header appears, stop scanning for lessons
    if (
      /^(?:HƯỚNG DẪN|HUONG DAN|LƯU Ý|LUU Y|GHI CHÚ|GHI CHU|NOTE|NOTES|GUIDE|INSTRUCTION|INSTRUCTIONS|QUY TẮC|QUY TAC)\b/i.test(
        line
      )
    ) {
      break;
    }

    const match = line.match(LESSON_HEADER_REGEX);
    if (match) {
      const lessonNumber = match[1].trim();
      let inlineTitle = match[2]
        ? match[2].replace(/^[:\-–—.]+\s*/, '').replace(/[:\-–—.]+$/, '').trim()
        : undefined;
      if (!inlineTitle || isInstructionText(inlineTitle)) {
        inlineTitle = undefined;
      }
      lessonStartIndices.push({
        index: i,
        lessonNumber,
        inlineTitle,
      });
    }
  }

  if (lessonStartIndices.length === 0) {
    errors.push(FORMAT_ERROR_GUIDE_TEXT);
    return {
      fileId,
      fileName,
      fileSize: 0,
      detectedClass,
      detectedGrade,
      lessons: [],
      errors,
      rawText,
    };
  }

  const parsedLessons: ImportedLesson[] = [];

  for (let lIdx = 0; lIdx < lessonStartIndices.length; lIdx++) {
    const startObj = lessonStartIndices[lIdx];
    const startIndex = startObj.index;
    const endIndex =
      lIdx < lessonStartIndices.length - 1
        ? lessonStartIndices[lIdx + 1].index
        : lines.length;

    const blockLines = lines.slice(startIndex, endIndex);

    // Initial values
    let lessonNumber = startObj.lessonNumber;
    let title = startObj.inlineTitle || '';
    let rawType = '';
    let lessonClass = detectedClass;
    let lessonGrade = detectedGrade;

    // Section parser state
    type SectionState = 'NONE' | 'WORDS' | 'SENTENCES' | 'CONTENT' | 'PARAGRAPH';
    let currentSection: SectionState = 'NONE';

    const wordsList: string[] = [];
    const sentencesList: string[] = [];
    const contentLines: string[] = [];
    const paragraphLines: string[] = [];

    // Parse lines within the lesson block (skip first line which was the lesson header)
    for (let i = 1; i < blockLines.length; i++) {
      const rawLine = blockLines[i];
      const line = rawLine.trim();

      // Skip empty lines or pure separator lines
      if (!line || /^[=\-_*~#]{3,}$/.test(line)) {
        continue;
      }

      // If a guide or instruction section begins at the end of file/lesson, stop processing this lesson
      if (
        /^(?:HƯỚNG DẪN|HUONG DAN|LƯU Ý|LUU Y|GHI CHÚ|GHI CHU|NOTE|NOTES|GUIDE|INSTRUCTION|INSTRUCTIONS)\b/i.test(
          line
        )
      ) {
        break;
      }

      // Skip instruction sentences
      if (isInstructionText(line)) {
        continue;
      }

      // Check explicit metadata lines:
      const titleMatch = line.match(
        /^(?:TITLE|TIÊU ĐỀ|TIEU DE|TÊN BÀI|TEN BAI):\s*(.+)$/i
      );
      if (titleMatch) {
        title = titleMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      const typeMatch = line.match(
        /^(?:TYPE|LOẠI|LOAI|LOẠI BÀI|LOAI BAI):\s*(.+)$/i
      );
      if (typeMatch) {
        rawType = typeMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      const classMatch = line.match(/^(?:CLASS|LỚP|LOP):\s*(.+)$/i);
      if (classMatch) {
        lessonClass = classMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      const gradeMatch = line.match(/^(?:GRADE|KHỐI|KHOI):\s*(.+)$/i);
      if (gradeMatch) {
        lessonGrade = gradeMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      // Check standalone Section Headers (e.g. "WORDS:", "SENTENCES:", "CONTENT:")
      if (/^(?:WORDS?|TỪ VỰNG|TU VUNG|TỪ)\s*[:\-]?$/i.test(line)) {
        currentSection = 'WORDS';
        continue;
      }
      if (/^(?:SENTENCES?|CÂU|CAU)\s*[:\-]?$/i.test(line)) {
        currentSection = 'SENTENCES';
        continue;
      }
      if (/^(?:CONTENT|NỘI DUNG|NOI DUNG)\s*[:\-]?$/i.test(line)) {
        currentSection = 'CONTENT';
        continue;
      }
      if (/^(?:PARAGRAPH|ĐOẠN VĂN|DOAN VAN|ĐOẠN)\s*[:\-]?$/i.test(line)) {
        currentSection = 'PARAGRAPH';
        continue;
      }

      // Check inline section headers e.g. "WORDS: apple, banana" or "CONTENT: This is my school."
      const inlineWords = line.match(
        /^(?:WORDS?|TỪ VỰNG|TU VUNG|TỪ)\s*[:\-]\s*(.+)$/i
      );
      if (inlineWords) {
        currentSection = 'WORDS';
        const itemClean = cleanTextItem(inlineWords[1]);
        if (itemClean && !isInstructionText(itemClean)) {
          if (itemClean.includes(',') && !itemClean.includes('.')) {
            itemClean
              .split(',')
              .map((w) => cleanTextItem(w))
              .filter((w) => Boolean(w) && !isInstructionText(w))
              .forEach((w) => wordsList.push(w));
          } else {
            wordsList.push(itemClean);
          }
        }
        continue;
      }

      const inlineSentences = line.match(/^(?:SENTENCES?|CÂU|CAU)\s*[:\-]\s*(.+)$/i);
      if (inlineSentences) {
        currentSection = 'SENTENCES';
        const itemClean = cleanTextItem(inlineSentences[1]);
        if (itemClean && !isInstructionText(itemClean)) sentencesList.push(itemClean);
        continue;
      }

      const inlineContent = line.match(
        /^(?:CONTENT|NỘI DUNG|NOI DUNG)\s*[:\-]\s*(.+)$/i
      );
      if (inlineContent) {
        currentSection = 'CONTENT';
        const itemClean = cleanTextItem(inlineContent[1]);
        if (itemClean && !isInstructionText(itemClean)) contentLines.push(itemClean);
        continue;
      }

      const inlineParagraph = line.match(
        /^(?:PARAGRAPH|ĐOẠN VĂN|DOAN VAN)\s*[:\-]\s*(.+)$/i
      );
      if (inlineParagraph) {
        currentSection = 'PARAGRAPH';
        const itemClean = cleanTextItem(inlineParagraph[1]);
        if (itemClean && !isInstructionText(itemClean)) paragraphLines.push(itemClean);
        continue;
      }

      // Auto-detect Title if not specified yet:
      // If we are before any section header (currentSection === 'NONE') and don't have a title yet,
      // the first non-keyword text line is treated as Title.
      if (currentSection === 'NONE' && !title) {
        if (!isIgnorableLine(line) && !isInstructionText(line)) {
          title = cleanTextItem(line);
          continue;
        }
      }

      // If line is an ignorable line, skip it
      if (isIgnorableLine(line)) {
        continue;
      }

      // Add lines according to current section
      const cleanedLine = cleanTextItem(line);
      if (!cleanedLine || isInstructionText(cleanedLine)) continue;

      switch (currentSection) {
        case 'WORDS':
          if (cleanedLine.includes(',') && !cleanedLine.includes('.')) {
            cleanedLine
              .split(',')
              .map((w) => cleanTextItem(w))
              .filter((w) => Boolean(w) && !isInstructionText(w))
              .forEach((w) => wordsList.push(w));
          } else {
            wordsList.push(cleanedLine);
          }
          break;
        case 'SENTENCES':
          sentencesList.push(cleanedLine);
          break;
        case 'PARAGRAPH':
          paragraphLines.push(cleanedLine);
          break;
        case 'CONTENT':
        case 'NONE':
        default:
          contentLines.push(cleanedLine);
          break;
      }
    }

    // Determine final Lesson Content Type
    let finalType: LessonContentType = 'SENTENCES';
    if (rawType) {
      finalType = normalizeLessonType(rawType);
    } else {
      // Auto-detect based on collected sections
      if (wordsList.length > 0 && sentencesList.length > 0) {
        finalType = 'WORDS_AND_SENTENCES';
      } else if (wordsList.length > 0 && sentencesList.length === 0) {
        finalType = 'WORDS';
      } else if (paragraphLines.length > 0) {
        finalType = 'PARAGRAPH';
      } else {
        finalType = 'SENTENCES';
      }
    }

    // Dispatch contentLines according to finalType if sections weren't explicitly separated
    if (contentLines.length > 0) {
      if (finalType === 'WORDS') {
        contentLines.forEach((l) => {
          if (l.includes(',') && !l.includes('.')) {
            l.split(',')
              .map((w) => cleanTextItem(w))
              .filter((w) => Boolean(w) && !isInstructionText(w))
              .forEach((w) => wordsList.push(w));
          } else {
            const cleaned = cleanTextItem(l);
            if (cleaned && !isInstructionText(cleaned)) wordsList.push(cleaned);
          }
        });
      } else if (finalType === 'PARAGRAPH') {
        paragraphLines.push(...contentLines);
      } else if (finalType === 'WORDS_AND_SENTENCES') {
        contentLines.forEach((l) => {
          const cleaned = cleanTextItem(l);
          if (!cleaned || isInstructionText(cleaned)) return;
          if (cleaned.split(/\s+/).length <= 2 && !/[.!?]$/.test(cleaned)) {
            wordsList.push(cleaned);
          } else {
            sentencesList.push(cleaned);
          }
        });
      } else {
        // SENTENCES or MIXED
        sentencesList.push(...contentLines);
      }
    }

    // Paragraph text construction
    let paragraph: string | undefined;
    if (paragraphLines.length > 0) {
      paragraph = paragraphLines.join(' ');
      if (sentencesList.length === 0) {
        sentencesList.push(...splitParagraphIntoSentences(paragraph));
      }
    }

    // Sanitize and filter out any lingering keyword lines or empty items
    const sanitizedWords = wordsList
      .map((w) => cleanTextItem(w))
      .filter((w) => w.length > 0 && !isIgnorableLine(w) && !isInstructionText(w));

    const sanitizedSentences = sentencesList
      .map((s) => cleanTextItem(s))
      .filter((s) => s.length > 0 && !isIgnorableLine(s) && !isInstructionText(s));

    // Validation for this lesson:
    // 1. lessonNumber must be a valid number
    const isInvalidNumber =
      !lessonNumber || !/^\d+[a-zA-Z]?$/.test(lessonNumber.trim());

    // 2. Clear title if it is an instruction sentence
    if (isInstructionText(title)) {
      title = '';
    }

    // 3. Must have real content (words, sentences, or paragraph)
    const hasContent =
      sanitizedWords.length > 0 ||
      sanitizedSentences.length > 0 ||
      (paragraph !== undefined && paragraph.trim().length > 0);

    // Skip fake lessons, non-numeric lessons, or empty lessons without real content
    if (isInvalidNumber || !hasContent) {
      continue;
    }

    if (!title.trim()) {
      title = `Lesson ${lessonNumber}`;
    }

    parsedLessons.push({
      id: `imp_${Date.now()}_${lIdx}_${Math.random().toString(36).slice(2, 6)}`,
      lessonNumber,
      title: title.trim(),
      type: finalType,
      words: sanitizedWords,
      sentences: sanitizedSentences,
      paragraph,
      selected: true, // auto-select valid lessons
      fileId,
      fileName,
      detectedClass: lessonClass,
      detectedGrade: lessonGrade,
      validationError: undefined,
    });
  }

  if (parsedLessons.length === 0) {
    errors.push(FORMAT_ERROR_GUIDE_TEXT);
  }

  return {
    fileId,
    fileName,
    fileSize: 0,
    detectedClass,
    detectedGrade,
    lessons: parsedLessons,
    errors,
    rawText,
  };
}

/**
 * Converts an ImportedLesson into a ready-to-save DictationExercise & passage.
 */
export function convertImportedLessonToDictation(
  lesson: ImportedLesson,
  assignedClass?: string
): {
  title: string;
  classLevel: string;
  topic: string;
  passage: string;
  exercise: DictationExercise;
} {
  const sentenceItems: DictationSentence[] = [];
  const passageLines: string[] = [];

  if (lesson.type === 'WORDS') {
    lesson.words.forEach((w, idx) => {
      const trimmed = w.trim();
      if (trimmed) {
        sentenceItems.push({
          id: `w_${idx + 1}`,
          order: idx + 1,
          text: trimmed,
        });
        passageLines.push(trimmed);
      }
    });
  } else if (lesson.type === 'WORDS_AND_SENTENCES') {
    let order = 1;
    // Add words first
    lesson.words.forEach((w) => {
      const trimmed = w.trim();
      if (trimmed) {
        sentenceItems.push({
          id: `ws_w_${order}`,
          order,
          text: trimmed,
        });
        passageLines.push(trimmed);
        order++;
      }
    });
    // Add sentences
    lesson.sentences.forEach((s) => {
      const trimmed = s.trim();
      if (trimmed) {
        sentenceItems.push({
          id: `ws_s_${order}`,
          order,
          text: trimmed,
        });
        passageLines.push(trimmed);
        order++;
      }
    });
  } else if (lesson.type === 'PARAGRAPH') {
    const sents =
      lesson.sentences.length > 0
        ? lesson.sentences
        : splitParagraphIntoSentences(lesson.paragraph || '');

    sents.forEach((s, idx) => {
      const trimmed = s.trim();
      if (trimmed) {
        sentenceItems.push({
          id: `p_${idx + 1}`,
          order: idx + 1,
          text: trimmed,
        });
      }
    });
    passageLines.push(lesson.paragraph || sents.join(' '));
  } else {
    // SENTENCES or MIXED
    lesson.sentences.forEach((s, idx) => {
      const trimmed = s.trim();
      if (trimmed) {
        sentenceItems.push({
          id: `s_${idx + 1}`,
          order: idx + 1,
          text: trimmed,
        });
        passageLines.push(trimmed);
      }
    });
  }

  // Fallback if empty
  if (sentenceItems.length === 0) {
    sentenceItems.push({
      id: 's_1',
      order: 1,
      text: lesson.title,
    });
    passageLines.push(lesson.title);
  }

  const classLevel =
    assignedClass || lesson.detectedClass || lesson.detectedGrade || 'General';

  // Clean title formatting:
  // If title already starts with Lesson/Unit/Bài, use it directly. Otherwise format "Lesson X: Title"
  let displayTitle = lesson.title;
  if (
    !/^(?:Lesson|Unit|Bài|Bai)\s+[0-9]+/i.test(lesson.title) &&
    lesson.lessonNumber
  ) {
    displayTitle = `Lesson ${lesson.lessonNumber}: ${lesson.title}`;
  }

  const exercise: DictationExercise = {
    title: displayTitle,
    sentences: sentenceItems,
    voiceMode: 'NATURAL',
    voiceAccent: 'US',
    playbackSpeed: 0.9,
    listenLimit: 3,
    checkMode: 'EASY',
    exerciseMode: 'PRACTICE',
    createdAt: new Date().toISOString(),
  };

  return {
    title: displayTitle,
    classLevel,
    topic: lesson.title,
    passage: passageLines.join('\n'),
    exercise,
  };
}
