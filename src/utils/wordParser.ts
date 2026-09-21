import mammothModule from 'mammoth';
import { ImportedLesson, ImportFileResult, LessonContentType } from '../types/import';
import { DictationExercise, DictationSentence } from '../types';

// Safely get mammoth instance whether ESM or CJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammoth: any = (mammothModule as any)?.default || mammothModule;

/**
 * Standard error message when no lessons are detected.
 */
export const FORMAT_ERROR_GUIDE_TEXT = `Không tìm thấy bài học trong file.

Vui lòng kiểm tra file Word có cấu trúc:
Cách 1 (Có tiêu đề bài):
TITLE: Tên bài học
CONTENT:
Nội dung bài học (từ vựng hoặc câu)

Cách 2 (Có Lesson/Bài):
LESSON 1: Tên bài học (hoặc UNIT 1 • LESSON 1)
CONTENT:
Nội dung bài học`;

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
export function normalizeLessonType(rawType: string): LessonContentType {
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

/**
 * Regex for matching explicit composite header (UNIT X • LESSON Y: Title)
 */
export const COMPOSITE_HEADER_REGEX =
  /^\s*(?:UNIT|BÀI\s*HỌC)\s*(\d+[a-zA-Z]?)\s*[\s•\-\–—./,|]+\s*(?:LESSON|BÀI|BAI)\s*(?::\s*|\s+)(\d+[a-zA-Z]?)(?:\s*[:\-–—.]\s*|\s+|$)(.*)$/i;

/**
 * Unified Regex for explicit lesson headers:
 * Matches: "LESSON: 1", "LESSON 1: Title", "LESSON: 1: Title", "Lesson 1 – Title", "BÀI: 1", "BÀI 1: Title", "LESSON: 50"
 */
export const UNIFIED_LESSON_REGEX =
  /^\s*(?:LESSON|BÀI|BAI)\s*(?::\s*|\s+)(\d+[a-zA-Z]?)(?:\s*[:\-–—.]\s*|\s+|$)(.*)$/i;

/**
 * Regex for explicit standalone lesson header (kept for backward compatibility)
 */
export const STANDALONE_LESSON_REGEX = UNIFIED_LESSON_REGEX;

/**
 * Regex for Title anchor line (TITLE: ...)
 */
export const TITLE_TAG_REGEX =
  /^\s*(?:TITLE|TIÊU\s*ĐỀ|TIEU\s*DE|TÊN\s*BÀI|TEN\s*BAI)\s*:\s*(.+)$/i;

/**
 * Regex for metadata lesson line (LESSON: 1)
 */
export const LESSON_TAG_REGEX =
  /^\s*(?:LESSON|BÀI|BAI)\s*:\s*(\d+[a-zA-Z]?)\s*$/i;

/**
 * Regex for Unit-only header line (UNIT 1: Title or UNIT: 1)
 */
export const UNIT_HEADER_REGEX =
  /^\s*(?:UNIT|BÀI\s*HỌC)\s*(?::\s*|\s+)(\d+[a-zA-Z]?)(?:\s*[:\-–—.]\s*|\s+|$)(.*)$/i;

/**
 * Legacy general regex kept for backward compatibility with external calls.
 */
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
    /^(?:HƯỚNG DẪN|HUONG DAN|LƯU Ý|LUU Y|GHI CHÚ|GHI CHU|NOTE|NOTES|GUIDE|INSTRUCTION|INSTRUCTIONS|QUY TẮC|QUY TAC)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Standalone section headers that should never be treated as content text
  if (
    /^(?:WORDS?|SENTENCES?|CONTENT|PARAGRAPH|TYPE|CLASS|GRADE|GROUP|NHÓM|NHOM|TITLE|TRANSLATION|BẢN DỊCH|BAN DICH|DỊCH|DICH|VIETNAMESE|TIẾNG VIỆT|TIENG VIET|TỪ|TỪ VỰNG|TU VUNG|CÂU|CAU|NỘI DUNG|NOI DUNG|ĐOẠN VĂN|DOAN VAN|LOẠI|LOẠI BÀI|LỚP|LOP|KHỐI|KHOI|TIÊU ĐỀ|TIEU DE|TÊN BÀI|TEN BAI|UNIT|BÀI HỌC|BAI HOC|UNIT TITLE|TÊN UNIT|TEN UNIT)\s*[:\-]?$/i.test(
      trimmed
    )
  ) {
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
      /^(?:WORDS?|SENTENCES?|CONTENT|PARAGRAPH|TRANSLATION|BẢN DỊCH|BAN DICH|DỊCH|DICH|VIETNAMESE|TIẾNG VIỆT|TIENG VIET|TỪ VỰNG|CÂU|NỘI DUNG|GROUP|NHÓM|NHOM)\s*[:\-]\s*/i,
      ''
    )
    .replace(/^[0-9]+[.)]\s*/, '') // e.g. "1. apple" -> "apple"
    .replace(/^[-*•–—]\s*/, '') // e.g. "- apple" -> "apple"
    .trim();
}

/**
 * Strips prefixes like "Lesson 1:", "Bài 1 -", "Unit 1 • Lesson 1:", etc. from titles.
 * Preserves the actual topic/title cleanly.
 */
export function cleanLessonTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let cleaned = rawTitle.trim();

  // Strip enclosing quotes if any
  cleaned = cleaned.replace(/^["'](.*)["']$/, '$1').trim();

  // Strip composite prefixes: "UNIT 1 • LESSON 1:", "Unit 1 - Lesson 1 -", etc.
  cleaned = cleaned.replace(
    /^\s*(?:UNIT|BÀI\s*HỌC)\s*\d+[a-zA-Z]?\s*[\s•\-\–—./,|]+\s*(?:LESSON|BÀI|BAI)\s*\d+[a-zA-Z]?\s*[:\-–—.]*\s*/i,
    ''
  );

  // Strip single prefixes: "Lesson 1:", "Bài 1 -", "Unit 1:"
  cleaned = cleaned.replace(
    /^\s*(?:LESSON|BÀI|BAI|UNIT)\s*(?::\s*|\s+)\d+[a-zA-Z]?\s*[:\-–—.]*\s*/i,
    ''
  );

  // Strip numbering like "1. ", "1) "
  cleaned = cleaned.replace(/^\d+[.)]\s*/, '');

  // Strip leading punctuation: ":", "-", "–", "—", "."
  cleaned = cleaned.replace(/^[:\-–—.]+\s*/, '').replace(/[:\-–—.]+$/, '').trim();

  return cleaned;
}

/**
 * Parses the raw lesson header string (backward compatibility helper).
 */
export function parseLessonHeaderLine(rawHeader: string): {
  lessonNumber: string;
  inlineTitle?: string;
} {
  // First check composite
  const compositeMatch = rawHeader.trim().match(COMPOSITE_HEADER_REGEX);
  if (compositeMatch) {
    const num = compositeMatch[2].trim();
    let inlineTitle = compositeMatch[3] ? cleanLessonTitle(compositeMatch[3]) : undefined;
    if (!inlineTitle || isInstructionText(inlineTitle)) {
      inlineTitle = undefined;
    }
    return { lessonNumber: num, inlineTitle };
  }

  // Then check standalone
  const standaloneMatch = rawHeader.trim().match(STANDALONE_LESSON_REGEX);
  if (standaloneMatch) {
    const num = standaloneMatch[1].trim();
    let inlineTitle = standaloneMatch[2] ? cleanLessonTitle(standaloneMatch[2]) : undefined;
    if (!inlineTitle || isInstructionText(inlineTitle)) {
      inlineTitle = undefined;
    }
    return { lessonNumber: num, inlineTitle };
  }

  // Fallback to legacy regex
  const match = rawHeader.trim().match(LESSON_HEADER_REGEX);
  if (match) {
    const num = match[1].trim();
    let inlineTitle = match[2] ? cleanLessonTitle(match[2]) : undefined;
    if (!inlineTitle || isInstructionText(inlineTitle)) {
      inlineTitle = undefined;
    }
    return { lessonNumber: num, inlineTitle };
  }

  return { lessonNumber: '', inlineTitle: undefined };
}

/**
 * Internal interface representing a candidate lesson boundary in the document.
 */
interface LessonBoundary {
  startIndex: number;
  lessonNumber?: string;
  inlineTitle?: string;
  unit?: string;
}

/**
 * Robust Word Content Parser for English Dictation Practice.
 * Supports:
 * - Primary Anchor: TITLE:
 * - Composite Headers: UNIT 1 • LESSON 1: Title
 * - Standalone Headers: LESSON 1: Title, BÀI 1: Title
 * - Title-Anchored (Lớp 10 / Lớp 12 legacy): TITLE: ... without LESSON header
 * - Table of Contents (TOC) exclusion
 * - Preserves complete metadata: Group, Grade, Class, Unit, UnitTitle, LessonNumber, Title
 */
export function parseWordContent(
  rawText: string,
  fileName: string,
  fileId: string
): ImportFileResult {
  const errors: string[] = [];
  const lines = rawText.split(/\r?\n/);

  let fileClass: string | undefined;
  let fileGrade: string | undefined;
  let fileGroup: string | undefined;
  let fileUnit: string | undefined;
  let fileUnitTitle: string | undefined;

  // 1. Scan for file-level headers (top of document, before instructions or lessons)
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();
    if (!fileGroup) {
      const groupMatch = line.match(/^(?:GROUP|NHÓM|NHOM):\s*(.+)$/i);
      if (groupMatch && groupMatch[1]) {
        fileGroup = groupMatch[1].trim();
      }
    }
    if (!fileClass) {
      const classMatch = line.match(/^(?:CLASS|LỚP|LOP):\s*(.+)$/i);
      if (classMatch && classMatch[1]) {
        fileClass = classMatch[1].trim();
      }
    }
    if (!fileGrade) {
      const gradeMatch = line.match(/^(?:GRADE|KHỐI|KHOI):\s*(.+)$/i);
      if (gradeMatch && gradeMatch[1]) {
        fileGrade = gradeMatch[1].trim();
      }
    }
    if (!fileUnitTitle) {
      const unitTitleMatch = line.match(
        /^(?:UNIT\s*TITLE|TÊN\s*UNIT|TEN\s*UNIT|TIÊU\s*ĐỀ\s*UNIT|TIEU\s*DE\s*UNIT):\s*(.+)$/i
      );
      if (unitTitleMatch && unitTitleMatch[1]) {
        fileUnitTitle = unitTitleMatch[1].trim();
      }
    }
    if (!fileUnit) {
      const unitMatch = line.match(/^(?:UNIT|BÀI\s*HỌC|BAI\s*HOC):\s*(.+)$/i);
      if (unitMatch && unitMatch[1]) {
        fileUnit = unitMatch[1].trim();
      }
    }
  }

  // 2. Identify TOC (Table of Contents) regions to prevent TOC lines from becoming lessons
  const isTOCLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // TOC section headers
    if (/^(?:TABLE\s*OF\s*CONTENTS|UNIT\s*CONTENTS|MỤC\s*LỤC|MUC\s*LUC|DANH\s*SÁCH\s*BÀI\s*HỌC)\b/i.test(trimmed)) {
      return true;
    }
    // Lines like "Unit 1: All about me! — 4 lessons" or "Unit 2: ... (4 bài)"
    if (/^(?:Unit|Bài)\s+\d+.*(?:—|-|\()?\s*\d+\s*(?:lessons?|bài)\b/i.test(trimmed)) {
      return true;
    }
    return false;
  };

  // 3. Scan candidate lesson boundaries across document lines
  const compositeMatches: LessonBoundary[] = [];
  const lessonMatches: LessonBoundary[] = [];
  const titleTagMatches: { lineIdx: number; title: string }[] = [];
  const unitTagMatches: { lineIdx: number; unit: string; inlineTitle?: string }[] = [];

  let inTOCSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check TOC section entry
    if (isTOCLine(line)) {
      inTOCSection = true;
      continue;
    }

    // Exit TOC section if real metadata or lesson header encountered
    if (
      inTOCSection &&
      (/^(?:GROUP|GRADE|CLASS|TYPE|WORDS|CONTENT):\s*/i.test(line) ||
        COMPOSITE_HEADER_REGEX.test(line) ||
        UNIFIED_LESSON_REGEX.test(line) ||
        TITLE_TAG_REGEX.test(line))
    ) {
      inTOCSection = false;
    }

    if (inTOCSection) {
      continue;
    }

    // Skip instruction sentences (do NOT break out of the document loop)
    if (isInstructionText(line)) {
      continue;
    }

    // Candidate 1: Composite Header (UNIT 1 • LESSON 1: Title)
    const compMatch = line.match(COMPOSITE_HEADER_REGEX);
    if (compMatch) {
      compositeMatches.push({
        startIndex: i,
        unit: compMatch[1].trim(),
        lessonNumber: compMatch[2].trim(),
        inlineTitle: compMatch[3] ? cleanLessonTitle(compMatch[3]) : undefined,
      });
      continue;
    }

    // Candidate 2: Explicit Lesson Header (LESSON: 1, LESSON 1: Title, Bài 1)
    const lMatch = line.match(UNIFIED_LESSON_REGEX);
    if (lMatch) {
      lessonMatches.push({
        startIndex: i,
        lessonNumber: lMatch[1].trim(),
        inlineTitle: lMatch[2] ? cleanLessonTitle(lMatch[2]) : undefined,
      });
      continue;
    }

    // Candidate 3: Title Tag (TITLE: ...)
    const titleMatch = line.match(TITLE_TAG_REGEX);
    if (titleMatch) {
      titleTagMatches.push({
        lineIdx: i,
        title: cleanLessonTitle(titleMatch[1]),
      });
      continue;
    }

    // Candidate 4: Unit Header (UNIT 1: Title or UNIT: 1)
    const uMatch = line.match(UNIT_HEADER_REGEX);
    if (uMatch && !line.includes('LESSON') && !line.includes('BÀI')) {
      unitTagMatches.push({
        lineIdx: i,
        unit: uMatch[1].trim(),
        inlineTitle: uMatch[2] ? cleanLessonTitle(uMatch[2]) : undefined,
      });
      continue;
    }
  }

  // 4. Select the Lesson Boundary Strategy based on priority:
  // Priority 1: Composite Headers if present in significant numbers (e.g. Lớp 5 has 80)
  // Priority 2: Unified Lesson Headers (e.g. Lớp 11 with 50 LESSON: 1... LESSON: 50, template with 4)
  // Priority 3: Title Tag Fallback (e.g. Lớp 10 with 50 TITLE: tags, no LESSON keyword)
  // Priority 4: Unit Header Fallback
  let chosenBoundaries: LessonBoundary[] = [];

  if (
    compositeMatches.length >= 10 ||
    (compositeMatches.length > 0 && compositeMatches.length >= lessonMatches.length)
  ) {
    chosenBoundaries = compositeMatches;
  } else if (lessonMatches.length > 0) {
    chosenBoundaries = lessonMatches;
  } else if (titleTagMatches.length > 0) {
    chosenBoundaries = titleTagMatches.map((t, idx) => ({
      startIndex: t.lineIdx,
      lessonNumber: String(idx + 1),
      inlineTitle: t.title,
    }));
  } else if (unitTagMatches.length > 0) {
    chosenBoundaries = unitTagMatches.map((u) => ({
      startIndex: u.lineIdx,
      unit: u.unit,
      lessonNumber: u.unit,
      inlineTitle: u.inlineTitle,
    }));
  }

  // 5. If no boundaries found, report format error
  if (chosenBoundaries.length === 0) {
    errors.push(FORMAT_ERROR_GUIDE_TEXT);
    return {
      fileId,
      fileName,
      fileSize: 0,
      detectedClass: fileClass,
      detectedGrade: fileGrade,
      detectedGroup: fileGroup,
      detectedUnit: fileUnit,
      detectedUnitTitle: fileUnitTitle,
      lessons: [],
      errors,
      rawText,
    };
  }

  // 6. Parse each lesson block into structured ImportedLesson
  const parsedLessons: ImportedLesson[] = [];
  let currentActiveUnit = fileUnit;
  let currentActiveUnitTitle = fileUnitTitle;

  for (let lIdx = 0; lIdx < chosenBoundaries.length; lIdx++) {
    const boundary = chosenBoundaries[lIdx];
    const startIndex = boundary.startIndex;
    const nextStartIndex =
      lIdx < chosenBoundaries.length - 1
        ? chosenBoundaries[lIdx + 1].startIndex
        : lines.length;

    // Scan forward from previous boundary to startIndex to capture any UNIT or UNIT TITLE headers
    // that appeared before this lesson:
    const prevBoundary = lIdx > 0 ? chosenBoundaries[lIdx - 1].startIndex : 0;
    for (let b = prevBoundary; b < startIndex; b++) {
      const bLine = lines[b].trim();
      const utMatch = bLine.match(
        /^(?:UNIT\s*TITLE|TÊN\s*UNIT|TEN\s*UNIT|TIÊU\s*ĐỀ\s*UNIT|TIEU\s*DE\s*UNIT):\s*(.+)$/i
      );
      if (utMatch && utMatch[1]) {
        currentActiveUnitTitle = utMatch[1].trim();
      }
      const uTagMatch = bLine.match(/^(?:UNIT|BÀI\s*HỌC|BAI\s*HOC):\s*(.+)$/i);
      if (uTagMatch && uTagMatch[1] && !bLine.includes('LESSON') && !bLine.includes('BÀI')) {
        currentActiveUnit = uTagMatch[1].trim();
      }
      const uHeaderMatch = bLine.match(UNIT_HEADER_REGEX);
      if (uHeaderMatch && !bLine.includes('LESSON') && !bLine.includes('BÀI')) {
        currentActiveUnit = uHeaderMatch[1].trim();
        if (uHeaderMatch[2]) {
          const possibleTitle = cleanLessonTitle(uHeaderMatch[2]);
          if (possibleTitle) {
            currentActiveUnitTitle = possibleTitle;
          }
        }
      }
      const grpMatch = bLine.match(/^(?:GROUP|NHÓM|NHOM):\s*(.+)$/i);
      if (grpMatch && grpMatch[1]) {
        fileGroup = grpMatch[1].trim();
      }
      const grdMatch = bLine.match(/^(?:GRADE|KHỐI|KHOI):\s*(.+)$/i);
      if (grdMatch && grdMatch[1]) {
        fileGrade = grdMatch[1].trim();
      }
      const clsMatch = bLine.match(/^(?:CLASS|LỚP|LOP):\s*(.+)$/i);
      if (clsMatch && clsMatch[1]) {
        fileClass = clsMatch[1].trim();
      }
    }

    // Initial values from boundary or file-level
    let lessonNumber = boundary.lessonNumber;
    let title = boundary.inlineTitle || '';
    let rawType = '';
    let lessonGroup = fileGroup;
    let lessonClass = fileClass;
    let lessonGrade = fileGrade;
    let lessonUnit = boundary.unit || currentActiveUnit;
    let lessonUnitTitle = currentActiveUnitTitle;

    // Determine the endIndex for this lesson:
    // This lesson ends at nextStartIndex, OR if a new UNIT header appears before nextStartIndex,
    // this lesson terminates right before that UNIT header so content does not bleed into the next Unit.
    let endIndex = nextStartIndex;
    if (lIdx < chosenBoundaries.length - 1) {
      for (let k = startIndex + 1; k < nextStartIndex; k++) {
        const checkLine = lines[k].trim();
        if (checkLine.includes('LESSON') || checkLine.includes('BÀI')) {
          continue;
        }

        const newUnitMatch = checkLine.match(UNIT_HEADER_REGEX);
        if (newUnitMatch) {
          const newUnitNum = newUnitMatch[1].trim();
          // Only terminate early if this represents a distinct, new Unit
          if (lessonUnit && newUnitNum !== lessonUnit) {
            endIndex = k;
            break;
          }
        }
      }
    }

    const blockLines = lines.slice(startIndex, endIndex);

    // Parser State Machine for content sections
    type SectionState =
      | 'NONE'
      | 'WORDS'
      | 'SENTENCES'
      | 'CONTENT'
      | 'PARAGRAPH'
      | 'TRANSLATION';
    let currentSection: SectionState = 'NONE';

    const wordsList: string[] = [];
    const sentencesList: string[] = [];
    const contentLines: string[] = [];
    const paragraphLines: string[] = [];
    const translationLines: string[] = [];

    // Parse lines within the lesson block
    for (let i = 0; i < blockLines.length; i++) {
      const rawLine = blockLines[i];
      const line = rawLine.trim();

      // Skip empty lines or pure separator lines
      if (!line || /^[=\-_*~#]{3,}$/.test(line)) {
        continue;
      }

      // Skip header line itself if at line 0 of this lesson block
      if (
        i === 0 &&
        (COMPOSITE_HEADER_REGEX.test(line) ||
          UNIFIED_LESSON_REGEX.test(line) ||
          LESSON_TAG_REGEX.test(line))
      ) {
        continue;
      }

      // 1. Metadata check: TITLE:
      const titleMatch = line.match(TITLE_TAG_REGEX);
      if (titleMatch) {
        title = cleanLessonTitle(titleMatch[1]);
        currentSection = 'NONE';
        continue;
      }

      // 2. Metadata check: TYPE:
      const typeMatch = line.match(
        /^(?:TYPE|LOẠI|LOAI|LOẠI BÀI|LOAI BAI):\s*(.+)$/i
      );
      if (typeMatch) {
        rawType = typeMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      // 3. Metadata check: GROUP:
      const groupMatch = line.match(/^(?:GROUP|NHÓM|NHOM):\s*(.+)$/i);
      if (groupMatch) {
        lessonGroup = groupMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      // 4. Metadata check: CLASS:
      const classMatch = line.match(/^(?:CLASS|LỚP|LOP):\s*(.+)$/i);
      if (classMatch) {
        lessonClass = classMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      // 5. Metadata check: GRADE:
      const gradeMatch = line.match(/^(?:GRADE|KHỐI|KHOI):\s*(.+)$/i);
      if (gradeMatch) {
        lessonGrade = gradeMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      // 6. Metadata check: UNIT TITLE:
      const unitTitleMatch = line.match(
        /^(?:UNIT\s*TITLE|TÊN\s*UNIT|TEN\s*UNIT|TIÊU\s*ĐỀ\s*UNIT|TIEU\s*DE\s*UNIT):\s*(.+)$/i
      );
      if (unitTitleMatch) {
        lessonUnitTitle = unitTitleMatch[1].trim();
        currentActiveUnitTitle = lessonUnitTitle;
        currentSection = 'NONE';
        continue;
      }

      // 7. Metadata check: UNIT:
      const unitMatch = line.match(/^(?:UNIT|BÀI\s*HỌC|BAI\s*HOC):\s*(.+)$/i);
      if (unitMatch) {
        lessonUnit = unitMatch[1].trim();
        currentActiveUnit = lessonUnit;
        currentSection = 'NONE';
        continue;
      }

      // 8. Metadata check: LESSON: (Secondary metadata within an active block)
      const lessonNumMatch = line.match(/^(?:LESSON|BÀI|BAI)\s*(?::\s*|\s+)(\d+[a-zA-Z]?)(?:\s*[:\-–—.]\s*|\s+|$)/i);
      if (lessonNumMatch) {
        lessonNumber = lessonNumMatch[1].trim();
        currentSection = 'NONE';
        continue;
      }

      // 9. Standalone Section Headers
      if (/^(?:WORDS?|TỪ\s*VỰNG|TU\s*VUNG|TỪ|TU)\s*[:\-]?$/i.test(line)) {
        currentSection = 'WORDS';
        continue;
      }
      if (/^(?:SENTENCES?|CÂU|CAU)\s*[:\-]?$/i.test(line)) {
        currentSection = 'SENTENCES';
        continue;
      }
      if (/^(?:CONTENT|NỘI\s*DUNG|NOI\s*DUNG)\s*[:\-]?$/i.test(line)) {
        currentSection = 'CONTENT';
        continue;
      }
      if (/^(?:PARAGRAPH|ĐOẠN\s*VĂN|DOAN\s*VAN|ĐOẠN|DOAN)\s*[:\-]?$/i.test(line)) {
        currentSection = 'PARAGRAPH';
        continue;
      }
      if (
        /^(?:TRANSLATION|BẢN\s*DỊCH|BAN\s*DICH|DỊCH|DICH|VIETNAMESE|TIẾNG\s*VIỆT|TIENG\s*VIET)\s*[:\-]?$/i.test(
          line
        )
      ) {
        currentSection = 'TRANSLATION';
        continue;
      }

      // 10. Inline Section Headers
      const inlineWords = line.match(
        /^(?:WORDS?|TỪ\s*VỰNG|TU\s*VUNG|TỪ|TU)\s*[:\-]\s*(.+)$/i
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
        /^(?:CONTENT|NỘI\s*DUNG|NOI\s*DUNG)\s*[:\-]\s*(.+)$/i
      );
      if (inlineContent) {
        currentSection = 'CONTENT';
        const itemClean = cleanTextItem(inlineContent[1]);
        if (itemClean && !isInstructionText(itemClean)) contentLines.push(itemClean);
        continue;
      }

      const inlineParagraph = line.match(
        /^(?:PARAGRAPH|ĐOẠN\s*VĂN|DOAN\s*VAN)\s*[:\-]\s*(.+)$/i
      );
      if (inlineParagraph) {
        currentSection = 'PARAGRAPH';
        const itemClean = cleanTextItem(inlineParagraph[1]);
        if (itemClean && !isInstructionText(itemClean)) paragraphLines.push(itemClean);
        continue;
      }

      const inlineTranslation = line.match(
        /^(?:TRANSLATION|BẢN\s*DỊCH|BAN\s*DICH|DỊCH|DICH|VIETNAMESE|TIẾNG\s*VIỆT|TIENG\s*VIET)\s*[:\-]\s*(.+)$/i
      );
      if (inlineTranslation) {
        currentSection = 'TRANSLATION';
        const itemClean = cleanTextItem(inlineTranslation[1]);
        if (itemClean && !isInstructionText(itemClean)) translationLines.push(itemClean);
        continue;
      }

      // Auto-detect Title if not set yet:
      if (currentSection === 'NONE' && !title) {
        if (!isIgnorableLine(line) && !isInstructionText(line)) {
          title = cleanLessonTitle(cleanTextItem(line));
          continue;
        }
      }

      // If line is ignorable, skip it
      if (isIgnorableLine(line)) {
        continue;
      }

      // Accumulate content line based on current section
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
        case 'TRANSLATION':
          translationLines.push(cleanedLine);
          break;
        case 'CONTENT':
        case 'NONE':
        default:
          contentLines.push(cleanedLine);
          break;
      }
    }

    // Determine final Content Type
    let finalType: LessonContentType = 'SENTENCES';
    if (rawType) {
      finalType = normalizeLessonType(rawType);
    } else {
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

    // Distribute contentLines according to finalType if sections weren't explicitly separated
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
      paragraph = paragraphLines.join('\n');
      if (sentencesList.length === 0) {
        sentencesList.push(...splitParagraphIntoSentences(paragraph));
      }
    }

    // Sanitize and filter
    const sanitizedWords = wordsList
      .map((w) => cleanTextItem(w))
      .filter((w) => w.length > 0 && !isIgnorableLine(w) && !isInstructionText(w));

    const sanitizedSentences = sentencesList
      .map((s) => cleanTextItem(s))
      .filter((s) => s.length > 0 && !isIgnorableLine(s) && !isInstructionText(s));

    // Fallback sequential lesson number if missing or invalid
    if (!lessonNumber || !/^\d+[a-zA-Z]?$/.test(lessonNumber.trim())) {
      lessonNumber = String(parsedLessons.length + 1);
    } else {
      lessonNumber = lessonNumber.trim();
    }

    // Fallback title if missing
    if (!title || !title.trim()) {
      title = `Lesson ${lessonNumber}`;
    } else {
      title = cleanLessonTitle(title);
    }

    // Content check: only drop if truly no content
    const hasContent =
      sanitizedWords.length > 0 ||
      sanitizedSentences.length > 0 ||
      (paragraph !== undefined && paragraph.trim().length > 0);

    if (!hasContent) {
      continue;
    }

    parsedLessons.push({
      id: `imp_${Date.now()}_${lIdx}_${Math.random().toString(36).slice(2, 6)}`,
      lessonNumber,
      title: title.trim(),
      type: finalType,
      words: sanitizedWords,
      sentences: sanitizedSentences,
      paragraph,
      translation:
        translationLines.length > 0 ? translationLines.join('\n').trim() : undefined,
      selected: true,
      fileId,
      fileName,
      detectedGroup: lessonGroup,
      detectedClass: lessonClass,
      detectedGrade: lessonGrade,
      unitNumber: lessonUnit,
      unitTitle: lessonUnitTitle,
      detectedUnit: lessonUnit,
      detectedUnitTitle: lessonUnitTitle,
      validationError: undefined,
    });
  }

  if (parsedLessons.length === 0) {
    errors.push(FORMAT_ERROR_GUIDE_TEXT);
  }

  // 7. Post-parse health checks & diagnostics
  const totalLessons = parsedLessons.length;
  const detectedUnitsSet = new Set<string>();
  parsedLessons.forEach((l) => {
    if (l.unitNumber) detectedUnitsSet.add(l.unitNumber);
  });
  const detectedUnitsList = Array.from(detectedUnitsSet);
  const totalUnitsDetected = detectedUnitsList.length;

  const firstLessonNumber = parsedLessons.length > 0 ? parsedLessons[0].lessonNumber : undefined;
  const lastLessonNumber =
    parsedLessons.length > 0 ? parsedLessons[parsedLessons.length - 1].lessonNumber : undefined;

  // Track duplicate lesson numbers within the same file
  const numCountMap = new Map<string, number>();
  const duplicateLessonNumbers: string[] = [];
  parsedLessons.forEach((l) => {
    const count = (numCountMap.get(l.lessonNumber) || 0) + 1;
    numCountMap.set(l.lessonNumber, count);
    if (count === 2) {
      duplicateLessonNumbers.push(l.lessonNumber);
    }
  });

  // Check missing lesson numbers in sequential range
  const numericLessonNums = parsedLessons
    .map((l) => parseInt(l.lessonNumber, 10))
    .filter((n) => !isNaN(n));

  const missingLessonNumbers: number[] = [];
  if (numericLessonNums.length > 1) {
    const minNum = Math.min(...numericLessonNums);
    const maxNum = Math.max(...numericLessonNums);
    const numSet = new Set(numericLessonNums);
    for (let n = minNum; n <= maxNum; n++) {
      if (!numSet.has(n)) {
        missingLessonNumbers.push(n);
      }
    }
  }

  let auditWarning: string | undefined;
  if (missingLessonNumbers.length > 0) {
    auditWarning = `Phát hiện thiếu ${missingLessonNumbers.length} bài học trong dải số (${missingLessonNumbers.slice(0, 8).map((n) => `Bài ${n}`).join(', ')}${missingLessonNumbers.length > 8 ? '...' : ''}).`;
  } else if (totalLessons <= 7 && lines.length > 300) {
    auditWarning = `Cảnh báo: File dài (${lines.length} dòng) nhưng chỉ nhận diện được ${totalLessons} bài học. Vui lòng kiểm tra lại cấu trúc file Word.`;
  } else if (duplicateLessonNumbers.length > 0) {
    auditWarning = `Phát hiện bài học trùng số thứ tự trong file: Lesson ${duplicateLessonNumbers.join(', ')}.`;
  }

  return {
    fileId,
    fileName,
    fileSize: 0,
    detectedGroup: fileGroup,
    detectedClass: fileClass,
    detectedGrade: fileGrade,
    unitNumber: fileUnit || (detectedUnitsList.length === 1 ? detectedUnitsList[0] : undefined),
    unitTitle: fileUnitTitle,
    detectedUnit: fileUnit || (detectedUnitsList.length === 1 ? detectedUnitsList[0] : undefined),
    detectedUnitTitle: fileUnitTitle,
    lessons: parsedLessons,
    errors,
    rawText,
    totalUnitsDetected,
    detectedUnitsList,
    firstLessonNumber,
    lastLessonNumber,
    missingLessonNumbers,
    duplicateLessonNumbers,
    auditWarning,
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
  group?: string;
  grade?: string;
  unit?: string;
  unitTitle?: string;
  lessonNumber?: string;
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
    translation: lesson.translation,
    voiceMode: 'NATURAL',
    voiceAccent: 'US',
    playbackSpeed: 0.9,
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
    group: lesson.detectedGroup,
    grade: lesson.detectedGrade,
    unit: lesson.unitNumber || lesson.detectedUnit,
    unitTitle: lesson.unitTitle || lesson.detectedUnitTitle,
    lessonNumber: lesson.lessonNumber,
  };
}
