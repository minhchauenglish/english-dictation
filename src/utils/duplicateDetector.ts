import { SavedDictationItem, TeacherClass } from '../types';
import { ImportedLesson } from '../types/import';

/**
 * Normalizes a title for comparison:
 * 1. Strips leading "Lesson X:", "Bài X:", "Unit X:", "Lesson X -", etc.
 * 2. Trims, lowercases, and collapses multiple whitespace characters.
 * 3. Normalizes punctuation.
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  // Remove prefixes like "Lesson 1:", "Lesson 1 -", "Bài 1:", "Unit 1.", "Lesson 10:"
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
 * Extracts and normalizes lesson number (e.g. "4", "4A" -> "4", "4a")
 */
export function extractLessonNumber(title: string, explicitNumber?: string): string {
  if (explicitNumber && explicitNumber.trim()) {
    return explicitNumber.trim().toLowerCase();
  }
  const match = title.match(/^\s*(?:lesson|unit|bài|bai)\s*(\d+[a-zA-Z]?)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return '';
}

/**
 * Normalizes class identifier or name for comparison:
 * - "KID2A" -> "kid2a"
 * - "KID 2A" -> "kid2a"
 * - "kid-2a" -> "kid2a"
 * - "Grade 3A" -> "grade3a"
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
 * Collects normalized class keys for an existing SavedDictationItem.
 */
export function getExistingClassKeys(
  item: SavedDictationItem,
  teacherClasses: TeacherClass[] = []
): Set<string> {
  const keys = new Set<string>();

  // 1. From classIds
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

  // 2. From classLevel
  if (item.classLevel && item.classLevel.trim()) {
    const norm = normalizeClassKey(item.classLevel);
    if (norm && norm !== 'general') {
      keys.add(norm);
      // Also check if any teacher class matches this name or ID
      const cls = teacherClasses.find(
        (c) => normalizeClassKey(c.name) === norm || normalizeClassKey(c.id) === norm
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

  // 1. From context targetClassIds (e.g. selected classes in the import modal)
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

  // 2. From context targetClassName (e.g. assignedClassLabel)
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

  // 3. From lesson.detectedClass (e.g. "KID2A" detected from Word file)
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

  // 4. From lesson.detectedGrade
  if (lesson.detectedGrade && lesson.detectedGrade.trim()) {
    const norm = normalizeClassKey(lesson.detectedGrade);
    if (norm && norm !== 'general') {
      keys.add(norm);
    }
  }

  return keys;
}

/**
 * Checks if the incoming class context overlaps with the existing class context.
 */
export function checkClassesOverlap(
  incomingKeys: Set<string>,
  existingKeys: Set<string>
): boolean {
  // If neither has any specific class, both are general/unassigned
  if (incomingKeys.size === 0 && existingKeys.size === 0) {
    return true;
  }

  // If one has a specific class and the other has none, they do not overlap
  if (incomingKeys.size === 0 || existingKeys.size === 0) {
    return false;
  }

  // Check intersection: must share at least one class token (e.g. 'kid2a' or 'c3')
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
 * Rules:
 * 1. Must match normalized title:
 *    "MY FATHER" is NOT duplicate of "MY PET", regardless of lesson numbers.
 * 2. Must match class context:
 *    "KID2A" is NOT duplicate of "KID1A", even if lesson number or title is identical.
 * 3. If lesson numbers are present on both, they must also match.
 */
export function isDuplicateLesson(
  incoming: {
    title: string;
    lessonNumber?: string;
    detectedClass?: string;
    detectedGrade?: string;
  },
  existing: SavedDictationItem,
  context?: DuplicateCheckContext
): boolean {
  // 1. Normalized title MUST match and be non-empty
  const incTitleNorm = normalizeTitle(incoming.title);
  const extTitleNorm = normalizeTitle(existing.title);
  if (!incTitleNorm || !extTitleNorm) return false;
  if (incTitleNorm !== extTitleNorm) return false;

  // 2. If both have an identifiable lesson number, they must match
  const incNum = extractLessonNumber(incoming.title, incoming.lessonNumber);
  const extNum = extractLessonNumber(existing.title);
  if (incNum && extNum && incNum !== extNum) {
    return false;
  }

  // 3. Class context must match
  const teacherClasses = context?.teacherClasses || [];
  const incomingClasses = getIncomingClassKeys(incoming, context);
  const existingClasses = getExistingClassKeys(existing, teacherClasses);

  return checkClassesOverlap(incomingClasses, existingClasses);
}

/**
 * Finds the duplicate item in an existing library for an incoming lesson.
 */
export function findDuplicateInLibrary(
  incoming: {
    title: string;
    lessonNumber?: string;
    detectedClass?: string;
    detectedGrade?: string;
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
      return {
        ...lesson,
        isDuplicate: true,
        duplicateExistingId: duplicate.id,
        duplicateExistingTitle: duplicate.title,
        // Keep existing resolution if user already chose, otherwise default to 'IMPORT_ANYWAY'
        duplicateResolution: lesson.duplicateResolution || 'IMPORT_ANYWAY',
      };
    }

    // Not a duplicate
    return {
      ...lesson,
      isDuplicate: false,
      duplicateExistingId: undefined,
      duplicateExistingTitle: undefined,
      duplicateResolution: undefined,
    };
  });
}
