import { SavedDictationItem, TeacherClass } from '../types';
import { ImportedLesson } from '../types/import';
import {
  classifyExerciseItem,
  classifyClassLevel,
  removeDiacritics,
} from './libraryFilters';

/**
 * Normalizes a title for comparison:
 * 1. Strips leading "Lesson X:", "Lesson 01:", "Bài X:", "Unit X:", "Lesson X -", etc.
 * 2. Trims, lowercases, and collapses multiple whitespace characters.
 * 3. Normalizes punctuation.
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  // Remove prefixes like "Lesson 1:", "Lesson 01:", "Lesson 1 -", "Bài 1:", "Unit 1.", "Lesson 10:"
  const core = rawTitle
    .replace(/^\s*(?:lesson|unit|bài|bai)\s*\d+[a-zA-Z]?\s*[:\-–—.]\s*/i, '')
    .trim();
  return core
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u1EF9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes main group to canonical group key:
 * E.g.:
 * - "LỚP 11", "Lớp 11", "Lop 11", "GRADE 11", "Grade 11", "Khối 11" => "LOP11"
 * - "LỚP 5", "Grade 5", "Lớp 5" => "LOP5"
 * - "LỚP 10", "Grade 10" => "LOP10"
 * - "MẦM NON", "Mầm non", "Preschool" => "MAMNON"
 * - "DEBATE", "Debate" => "DEBATE"
 * - "IELTS", "Ielts" => "IELTS"
 * - "GENERAL", "Chung" => "GENERAL"
 *
 * Rule: pure numbers like "11" without group indicator are NOT assumed as group.
 */
export function normalizeGroup(groupStr?: string): string | undefined {
  if (!groupStr || !groupStr.trim()) return undefined;
  const raw = groupStr.trim();
  const clean = removeDiacritics(raw).toLowerCase().replace(/[^a-z0-9]/g, '');

  // If input is purely digits (e.g. "11"), do NOT classify as group
  if (/^\d+$/.test(clean)) {
    return undefined;
  }

  // Preschool / Kindergarten / Mầm non
  if (
    clean.includes('mamnon') ||
    clean.includes('preschool') ||
    clean.includes('kindergarten') ||
    clean.startsWith('kid')
  ) {
    return 'MAMNON';
  }

  // Debate
  if (clean.includes('debate')) {
    return 'DEBATE';
  }

  // IELTS
  if (clean.includes('ielts')) {
    return 'IELTS';
  }

  // General
  if (clean.includes('general') || clean.includes('chung')) {
    return 'GENERAL';
  }

  // Grades 1-12 with group indicators: "lop", "grade", "khoi"
  // Match 10-12 first so 11 is not matched as 1
  const gradeMatch = clean.match(/(?:lop|grade|khoi)(1[0-2]|[1-9])(?![0-9])/);
  if (gradeMatch && gradeMatch[1]) {
    return `LOP${parseInt(gradeMatch[1], 10)}`;
  }

  // Fallback to libraryFilters classification
  const classified = classifyClassLevel(raw);
  if (classified.mainGroup && classified.mainGroup !== 'General') {
    const cg = removeDiacritics(classified.mainGroup).toLowerCase().replace(/[^a-z0-9]/g, '');
    const m = cg.match(/(?:lop|grade|khoi)(1[0-2]|[1-9])/);
    if (m && m[1]) {
      return `LOP${parseInt(m[1], 10)}`;
    }
    if (cg.includes('mamnon')) return 'MAMNON';
    if (cg.includes('debate')) return 'DEBATE';
    if (cg.includes('ielts')) return 'IELTS';
  }

  return undefined;
}

/**
 * Normalizes grade number to canonical grade string (e.g. "11", "5", "Grade 11" -> "11").
 */
export function getCanonicalGrade(gradeStr?: string): string | undefined {
  if (!gradeStr || !gradeStr.trim()) return undefined;
  const raw = gradeStr.trim();
  const clean = removeDiacritics(raw).toLowerCase();

  if (
    clean.includes('mam non') ||
    clean.includes('preschool') ||
    clean.includes('kindergarten')
  ) {
    return 'mam_non';
  }

  // Pure digits: check 10-12 or 1-9
  const pureDigitsMatch = clean.match(/^(1[0-2]|[1-9])$/);
  if (pureDigitsMatch && pureDigitsMatch[1]) {
    return String(parseInt(pureDigitsMatch[1], 10));
  }

  // Match grade 1-12 with prefix (grade, lop, khoi)
  const match = clean.match(/(?:grade|lop|lớp|khoi|khối)?\s*(1[0-2]|[1-9])(?:\b|[^0-9]|$)/i);
  if (match && match[1]) {
    return String(parseInt(match[1], 10));
  }

  return undefined;
}

export const normalizeGrade = getCanonicalGrade;
export const normalizeGradeNumber = getCanonicalGrade;

/**
 * Extracts and normalizes unit number (e.g. "1", "01", "Unit 1", "UNIT: 1" -> "1")
 */
export function normalizeUnit(unitStr?: string): string | undefined {
  if (!unitStr || !unitStr.trim()) return undefined;
  const raw = unitStr.trim();
  const match = raw.match(/(?:unit|bài|bai|u)?\s*[:\-–—.]?\s*(\d+[a-zA-Z]?)\b/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && String(parsed) === match[1].replace(/^0+/, '')) {
      return String(parsed);
    }
    return match[1].toLowerCase();
  }
  return undefined;
}

export function extractUnitNumber(
  explicitUnit?: string,
  topic?: string,
  title?: string
): string | undefined {
  if (explicitUnit && explicitUnit.trim()) {
    return normalizeUnit(explicitUnit);
  }
  if (topic && topic.trim()) {
    const m = topic.match(/\b(?:unit|bài|bai)\s*[:\-–—.]?\s*(\d+[a-zA-Z]?)\b/i);
    if (m && m[1]) return normalizeUnit(m[1]);
  }
  if (title && title.trim()) {
    const m = title.match(/\bunit\s*[:\-–—.]?\s*(\d+[a-zA-Z]?)\b/i);
    if (m && m[1]) return normalizeUnit(m[1]);
  }
  return undefined;
}

/**
 * Extracts and normalizes lesson number (e.g. "1", "01", "Lesson 1", "Bài 1" -> "1")
 */
export function normalizeLessonNumber(lessonStr?: string): string | undefined {
  if (!lessonStr || !lessonStr.trim()) return undefined;
  const raw = lessonStr.trim();
  const match = raw.match(/(?:lesson|bài|bai|l)?\s*[:\-–—.]?\s*(\d+[a-zA-Z]?)\b/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && String(parsed) === match[1].replace(/^0+/, '')) {
      return String(parsed);
    }
    return match[1].toLowerCase();
  }
  return undefined;
}

export function extractLessonNumber(
  explicitNumber?: string,
  title?: string
): string | undefined {
  if (explicitNumber && explicitNumber.trim()) {
    return normalizeLessonNumber(explicitNumber);
  }
  if (title && title.trim()) {
    const m = title.match(/^\s*(?:lesson|bài|bai)\s*[:\-–—.]?\s*(\d+[a-zA-Z]?)\b/i);
    if (m && m[1]) return normalizeLessonNumber(m[1]);
  }
  return undefined;
}

/**
 * Builds standard canonical duplicate key:
 * GROUP + GRADE + UNIT + LESSON + TITLE
 * E.g.: "LOP4|4|1|1|my friends"
 */
export function buildDuplicateKey(opts: {
  group?: string;
  grade?: string;
  unit?: string;
  lesson?: string;
  title: string;
}): string {
  const normGroup = normalizeGroup(opts.group) || '';
  const normGrade = getCanonicalGrade(opts.grade) || '';
  const normUnit = normalizeUnit(opts.unit) || '';
  const normLesson = normalizeLessonNumber(opts.lesson) || '';
  const normTitle = normalizeTitle(opts.title);
  return `${normGroup}|${normGrade}|${normUnit}|${normLesson}|${normTitle}`;
}

/**
 * Normalizes class identifier or name for comparison:
 * - "KID2A" -> "kid2a"
 * - "KID 2A" -> "kid2a"
 * - "kid-2a" -> "kid2a"
 */
export function normalizeClassKey(classStr?: string): string {
  if (!classStr) return '';
  return classStr
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export interface DuplicateCheckContext {
  targetClassIds?: string[];
  targetClassName?: string;
  targetGradeLevel?: string;
  teacherClasses?: TeacherClass[];
}

/**
 * Resolves the primary canonical group for an incoming lesson.
 */
export function resolveIncomingGroup(
  incoming: {
    detectedGroup?: string;
    detectedGrade?: string;
    detectedClass?: string;
  },
  context?: DuplicateCheckContext
): string | undefined {
  if (incoming.detectedGroup) {
    const g = normalizeGroup(incoming.detectedGroup);
    if (g) return g;
  }
  if (incoming.detectedClass) {
    const g = normalizeGroup(incoming.detectedClass);
    if (g) return g;
  }
  // Grade number (e.g. "11" -> LOP11)
  if (incoming.detectedGrade) {
    const g = normalizeGroup(incoming.detectedGrade);
    if (g) return g;
    const gradeNum = getCanonicalGrade(incoming.detectedGrade);
    if (gradeNum && gradeNum !== 'mam_non') {
      return `LOP${gradeNum}`;
    }
  }
  // Fallback context ONLY if lesson itself has zero group/grade/class
  if (
    !incoming.detectedGroup &&
    !incoming.detectedGrade &&
    !incoming.detectedClass
  ) {
    if (context?.targetGradeLevel) {
      const g = normalizeGroup(context.targetGradeLevel);
      if (g) return g;
    }
    if (context?.targetClassName) {
      const g = normalizeGroup(context.targetClassName);
      if (g) return g;
    }
  }
  return undefined;
}

/**
 * Resolves the primary canonical group for an existing SavedDictationItem.
 */
export function resolveExistingGroup(
  existing: SavedDictationItem,
  teacherClasses: TeacherClass[] = []
): string | undefined {
  if (existing.group) {
    const g = normalizeGroup(existing.group);
    if (g) return g;
  }
  if (existing.classLevel) {
    const g = normalizeGroup(existing.classLevel);
    if (g) return g;
  }
  if (existing.grade) {
    const g = normalizeGroup(existing.grade);
    if (g) return g;
    const gradeNum = getCanonicalGrade(existing.grade);
    if (gradeNum && gradeNum !== 'mam_non') {
      return `LOP${gradeNum}`;
    }
  }
  if (existing.classIds && existing.classIds.length > 0) {
    for (const cid of existing.classIds) {
      const cls = teacherClasses.find(
        (c) => c.id.toLowerCase() === cid.trim().toLowerCase()
      );
      if (cls) {
        if (cls.gradeLevel) {
          const g = normalizeGroup(cls.gradeLevel);
          if (g) return g;
        }
        if (cls.name) {
          const g = normalizeGroup(cls.name);
          if (g) return g;
        }
      }
    }
  }
  const classified = classifyExerciseItem(existing, teacherClasses);
  if (classified.mainGroup && classified.mainGroup !== 'General') {
    const g = normalizeGroup(classified.mainGroup);
    if (g) return g;
  }
  return undefined;
}

/**
 * Resolves the canonical grade for an incoming lesson.
 */
export function resolveIncomingGrade(
  incoming: {
    detectedGrade?: string;
    detectedGroup?: string;
    detectedClass?: string;
  },
  context?: DuplicateCheckContext
): string | undefined {
  if (incoming.detectedGrade) {
    const num = getCanonicalGrade(incoming.detectedGrade);
    if (num) return num;
  }
  if (incoming.detectedGroup) {
    const num = getCanonicalGrade(incoming.detectedGroup);
    if (num) return num;
  }
  if (incoming.detectedClass) {
    const num = getCanonicalGrade(incoming.detectedClass);
    if (num) return num;
  }
  if (
    !incoming.detectedGrade &&
    !incoming.detectedGroup &&
    !incoming.detectedClass
  ) {
    if (context?.targetGradeLevel) {
      const num = getCanonicalGrade(context.targetGradeLevel);
      if (num) return num;
    }
    if (context?.targetClassName) {
      const num = getCanonicalGrade(context.targetClassName);
      if (num) return num;
    }
  }
  return undefined;
}

/**
 * Resolves the canonical grade for an existing SavedDictationItem.
 */
export function resolveExistingGrade(
  existing: SavedDictationItem,
  teacherClasses: TeacherClass[] = []
): string | undefined {
  if (existing.grade) {
    const num = getCanonicalGrade(existing.grade);
    if (num) return num;
  }
  if (existing.group) {
    const num = getCanonicalGrade(existing.group);
    if (num) return num;
  }
  if (existing.classLevel) {
    const num = getCanonicalGrade(existing.classLevel);
    if (num) return num;
  }
  if (existing.classIds && existing.classIds.length > 0) {
    for (const cid of existing.classIds) {
      const cls = teacherClasses.find(
        (c) => c.id.toLowerCase() === cid.trim().toLowerCase()
      );
      if (cls) {
        if (cls.gradeLevel) {
          const num = getCanonicalGrade(cls.gradeLevel);
          if (num) return num;
        }
        if (cls.name) {
          const num = getCanonicalGrade(cls.name);
          if (num) return num;
        }
      }
    }
  }
  return undefined;
}

/**
 * Collects normalized class keys for an existing SavedDictationItem.
 */
export function getExistingClassKeys(
  item: SavedDictationItem,
  teacherClasses: TeacherClass[] = []
): Set<string> {
  const keys = new Set<string>();

  if (Array.isArray(item.classIds) && item.classIds.length > 0) {
    for (const cid of item.classIds) {
      if (!cid) continue;
      keys.add(cid.trim().toLowerCase());
      const cls = teacherClasses.find(
        (c) => c.id.toLowerCase() === cid.trim().toLowerCase()
      );
      if (cls) {
        const normName = normalizeClassKey(cls.name);
        if (normName) keys.add(normName);
        if (cls.gradeLevel) {
          const normGrade = normalizeClassKey(cls.gradeLevel);
          if (normGrade) keys.add(normGrade);
        }
      }
    }
  }

  if (item.classLevel && item.classLevel.trim()) {
    const norm = normalizeClassKey(item.classLevel);
    if (norm && norm !== 'general') {
      keys.add(norm);
      const cls = teacherClasses.find(
        (c) =>
          normalizeClassKey(c.name) === norm || normalizeClassKey(c.id) === norm
      );
      if (cls) {
        keys.add(cls.id.toLowerCase());
        if (cls.gradeLevel) {
          const normGrade = normalizeClassKey(cls.gradeLevel);
          if (normGrade) keys.add(normGrade);
        }
      }
    }
  }

  return keys;
}

/**
 * Collects normalized class keys for an incoming lesson & its import context.
 */
export function getIncomingClassKeys(
  lesson: {
    detectedClass?: string;
    detectedGrade?: string;
  },
  context?: DuplicateCheckContext
): Set<string> {
  const keys = new Set<string>();
  const teacherClasses = context?.teacherClasses || [];

  if (lesson.detectedClass && lesson.detectedClass.trim()) {
    const norm = normalizeClassKey(lesson.detectedClass);
    if (norm && norm !== 'general') {
      keys.add(norm);
      const cls = teacherClasses.find((c) => normalizeClassKey(c.name) === norm);
      if (cls) {
        keys.add(cls.id.toLowerCase());
        if (cls.gradeLevel) {
          const normGrade = normalizeClassKey(cls.gradeLevel);
          if (normGrade) keys.add(normGrade);
        }
      }
    }
  }

  if (lesson.detectedGrade && lesson.detectedGrade.trim()) {
    const norm = normalizeClassKey(lesson.detectedGrade);
    if (norm && norm !== 'general') {
      keys.add(norm);
    }
  }

  if (Array.isArray(context?.targetClassIds) && context.targetClassIds.length > 0) {
    for (const cid of context.targetClassIds) {
      if (!cid) continue;
      keys.add(cid.trim().toLowerCase());
      const cls = teacherClasses.find(
        (c) => c.id.toLowerCase() === cid.trim().toLowerCase()
      );
      if (cls) {
        const normName = normalizeClassKey(cls.name);
        if (normName) keys.add(normName);
        if (cls.gradeLevel) {
          const normGrade = normalizeClassKey(cls.gradeLevel);
          if (normGrade) keys.add(normGrade);
        }
      }
    }
  }

  if (context?.targetClassName && context.targetClassName.trim()) {
    const norm = normalizeClassKey(context.targetClassName);
    if (norm && norm !== 'general') {
      keys.add(norm);
      const cls = teacherClasses.find((c) => normalizeClassKey(c.name) === norm);
      if (cls) {
        keys.add(cls.id.toLowerCase());
        if (cls.gradeLevel) {
          const normGrade = normalizeClassKey(cls.gradeLevel);
          if (normGrade) keys.add(normGrade);
        }
      }
    }
  }

  return keys;
}

/**
 * Checks if incoming class keys overlap with existing class keys.
 */
export function checkClassesOverlap(
  incomingKeys: Set<string>,
  existingKeys: Set<string>
): boolean {
  if (incomingKeys.size === 0 && existingKeys.size === 0) {
    return true;
  }
  if (incomingKeys.size === 0 || existingKeys.size === 0) {
    return false;
  }
  for (const key of incomingKeys) {
    if (existingKeys.has(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Core Duplicate Checker:
 * Determines if an incoming lesson is a duplicate of an existing SavedDictationItem.
 *
 * Priority Order:
 * GROUP + GRADE + UNIT + LESSON + TITLE
 *
 * Strict Rules:
 * 1. TITLE MUST match after normalization.
 * 2. If BOTH have GROUP: must be identical. (e.g. LOP1 vs LOP4 => NOT DUPLICATE).
 * 3. If BOTH have GRADE: must be identical. (e.g. 5 vs 10 => NOT DUPLICATE).
 * 4. If BOTH have UNIT: must be identical. (e.g. Unit 1 vs Unit 2 => NOT DUPLICATE).
 * 5. If BOTH have LESSON: must be identical. (e.g. Lesson 1 vs Lesson 2 => NOT DUPLICATE).
 * 6. Missing metadata on one side:
 *    - Never assume missing GROUP means "same group".
 *    - Never mark DUPLICATE based on TITLE alone.
 *    - If one side has group/grade and the other lacks group/grade evidence, NOT DUPLICATE.
 */
export function isDuplicateLesson(
  incoming: {
    title: string;
    lessonNumber?: string;
    detectedGroup?: string;
    detectedGrade?: string;
    detectedClass?: string;
    unitNumber?: string;
    unitTitle?: string;
    detectedUnit?: string;
    detectedUnitTitle?: string;
  },
  existing: SavedDictationItem,
  context?: DuplicateCheckContext
): boolean {
  // 1. Normalized title MUST match and be non-empty
  const incTitleNorm = normalizeTitle(incoming.title);
  const extTitleNorm = normalizeTitle(existing.title);
  if (!incTitleNorm || !extTitleNorm) return false;
  if (incTitleNorm !== extTitleNorm) return false;

  const teacherClasses = context?.teacherClasses || [];

  // 2. GROUP Comparison
  const incGroup = resolveIncomingGroup(incoming, context);
  const extGroup = resolveExistingGroup(existing, teacherClasses);
  if (incGroup && extGroup && incGroup !== extGroup) {
    return false;
  }

  // 3. GRADE Comparison
  const incGrade = resolveIncomingGrade(incoming, context);
  const extGrade = resolveExistingGrade(existing, teacherClasses);
  if (incGrade && extGrade && incGrade !== extGrade) {
    return false;
  }

  // 4. UNIT Comparison
  const incUnit = extractUnitNumber(
    incoming.unitNumber || incoming.detectedUnit,
    undefined,
    incoming.title
  );
  const extUnit = extractUnitNumber(existing.unit, existing.topic, existing.title);
  if (incUnit && extUnit && incUnit !== extUnit) {
    return false;
  }

  // 5. LESSON NUMBER Comparison
  const incLesson = extractLessonNumber(incoming.lessonNumber, incoming.title);
  const extLesson = extractLessonNumber(existing.lessonNumber, existing.title);
  if (incLesson && extLesson && incLesson !== extLesson) {
    return false;
  }

  // 6. Verification of Positive Evidence (Guard against missing metadata)
  // Rule: Do NOT mark DUPLICATE if one side has group/grade but the other side
  // has zero group/grade evidence. TITLE alone is never sufficient.
  const hasGroupOrGradeOnIncoming = Boolean(incGroup || incGrade);
  const hasGroupOrGradeOnExisting = Boolean(extGroup || extGrade);

  if (hasGroupOrGradeOnIncoming && !hasGroupOrGradeOnExisting) {
    // Incoming belongs to a specific group/grade (e.g. LỚP 11),
    // but existing lesson has no group or grade. Not enough evidence => NOT DUPLICATE.
    return false;
  }

  if (!hasGroupOrGradeOnIncoming && hasGroupOrGradeOnExisting) {
    // Existing belongs to a specific group/grade, but incoming has none.
    return false;
  }

  // If neither side has a standard group/grade: check class keys for legacy items (e.g. KID1A vs KID2A)
  if (!hasGroupOrGradeOnIncoming && !hasGroupOrGradeOnExisting) {
    const incomingClasses = getIncomingClassKeys(incoming, context);
    const existingClasses = getExistingClassKeys(existing, teacherClasses);
    if (incomingClasses.size > 0 && existingClasses.size > 0) {
      if (!checkClassesOverlap(incomingClasses, existingClasses)) {
        return false;
      }
    } else {
      // Both lack group, grade, and class context. Only title is present.
      // Rule 9: Title alone is insufficient evidence. => NOT DUPLICATE.
      return false;
    }
  }

  return true;
}

/**
 * Finds the duplicate item in an existing library for an incoming lesson.
 */
export function findDuplicateInLibrary(
  incoming: {
    title: string;
    lessonNumber?: string;
    detectedGroup?: string;
    detectedGrade?: string;
    detectedClass?: string;
    unitNumber?: string;
    unitTitle?: string;
    detectedUnit?: string;
    detectedUnitTitle?: string;
  },
  existingLibrary: SavedDictationItem[],
  context?: DuplicateCheckContext
): SavedDictationItem | undefined {
  return existingLibrary.find((existing) =>
    isDuplicateLesson(incoming, existing, context)
  );
}

/**
 * Re-evaluates duplicate status for a list of ImportedLessons given active class context.
 */
export function evaluateLessonDuplicates(
  lessons: ImportedLesson[],
  existingLibrary: SavedDictationItem[],
  context?: DuplicateCheckContext
): ImportedLesson[] {
  return lessons.map((lesson) => {
    const duplicate = findDuplicateInLibrary(lesson, existingLibrary, context);

    if (duplicate) {
      const existingGroup =
        duplicate.group ||
        (context?.teacherClasses &&
          resolveExistingGroup(duplicate, context.teacherClasses)) ||
        duplicate.classLevel;
      const existingUnit =
        duplicate.unit ||
        extractUnitNumber(undefined, duplicate.topic, duplicate.title);
      const existingLesson =
        duplicate.lessonNumber ||
        extractLessonNumber(undefined, duplicate.title);

      return {
        ...lesson,
        isDuplicate: true,
        duplicateExistingId: duplicate.id,
        duplicateExistingTitle: duplicate.title,
        duplicateExistingGroup: existingGroup,
        duplicateExistingUnit: existingUnit,
        duplicateExistingLesson: existingLesson,
        duplicateResolution: lesson.duplicateResolution || 'IMPORT_ANYWAY',
      };
    }

    // Not a duplicate
    return {
      ...lesson,
      isDuplicate: false,
      duplicateExistingId: undefined,
      duplicateExistingTitle: undefined,
      duplicateExistingGroup: undefined,
      duplicateExistingUnit: undefined,
      duplicateExistingLesson: undefined,
      duplicateResolution: undefined,
    };
  });
}
