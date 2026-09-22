import { SavedDictationItem, TeacherClass } from '../types';
import {
  normalizeTitle,
  normalizeGroup,
  getCanonicalGrade,
  normalizeUnit,
  normalizeLessonNumber,
  extractUnitNumber,
  extractLessonNumber,
  resolveExistingGroup,
  resolveExistingGrade,
} from './duplicateDetector';

export interface DuplicateClusterItem {
  item: SavedDictationItem;
  isKeep: boolean;
  isExactMatch: boolean;
  hasContentWarning: boolean;
  similarityReason: string;
  selectedForDeletion: boolean;
}

export interface DuplicateCluster {
  id: string;
  label: string;
  categoryType: 'DEBATE' | 'GRADE_LESSON' | 'GENERAL';
  groupName: string;
  unit?: string;
  lesson?: string;
  lessonCode?: string;
  title: string;
  keepItem: SavedDictationItem;
  duplicateItems: DuplicateClusterItem[];
  allCount: number;
}

export interface DuplicateScanReport {
  totalScanned: number;
  duplicateClustersCount: number;
  totalDuplicateItemsCount: number;
  confirmedDuplicatesCount: number;
  warningItemsCount: number;
  clusters: DuplicateCluster[];
}

export interface CleanupBackupData {
  timestamp: string;
  deletedItems: SavedDictationItem[];
  previousAssignments?: Record<string, string>;
  migratedAssignmentsMap?: Record<string, string>;
  restored: boolean;
}

const CLEANUP_BACKUP_KEY = 'eng_dict_duplicate_cleanup_backup_v1';

/**
 * Normalizes text for strict sentence comparison:
 * - Trims whitespace
 * - Collapses spaces and linebreaks
 * - Lowercases text
 * - Normalizes typographical quotes and dashes
 * - Strips punctuation marks for clean semantic comparison
 */
export function normalizeSentenceForStrictComparison(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*([.,!?;:"])\s*/g, '$1 ')
    .replace(/[^\w\s\u00C0-\u1EF9']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes content text for signature comparison (entire text, not just prefix)
 */
export function getContentSignature(item: SavedDictationItem): string {
  const sentences =
    item.exercise?.sentences?.map((s) => normalizeSentenceForStrictComparison(s.text)).filter(Boolean) || [];
  if (sentences.length > 0) {
    return sentences.join(' ');
  }
  return normalizeSentenceForStrictComparison(item.passage || '');
}

/**
 * Compares two lists of sentences with 100% strict equality:
 * - Must have the exact same number of sentences.
 * - Every single sentence in exact order must match 100% after normalization.
 * - No prefix matching, no 3-sentences sampling, no single-sentence shortcut.
 */
export function areSentencesStrictlyEqual(
  sentencesA: Array<{ text: string }>,
  sentencesB: Array<{ text: string }>
): boolean {
  if (sentencesA.length !== sentencesB.length) return false;
  if (sentencesA.length === 0) return false;

  for (let i = 0; i < sentencesA.length; i++) {
    const normA = normalizeSentenceForStrictComparison(sentencesA[i]?.text || '');
    const normB = normalizeSentenceForStrictComparison(sentencesB[i]?.text || '');
    if (!normA || !normB || normA !== normB) {
      return false;
    }
  }
  return true;
}

/**
 * Determines whether two items have 100% identical content.
 * Any divergence in any sentence or passage produces false.
 */
export function areContentsMatching(a: SavedDictationItem, b: SavedDictationItem): boolean {
  const sA = a.exercise?.sentences?.filter((s) => s.text && s.text.trim()) || [];
  const sB = b.exercise?.sentences?.filter((s) => s.text && s.text.trim()) || [];

  // 1. Both have structured sentences: require 100% exact match across all sentences
  if (sA.length > 0 && sB.length > 0) {
    return areSentencesStrictlyEqual(sA, sB);
  }

  // 2. One has sentences, other only has passage: check if joined sentences match passage
  if (sA.length > 0 && sB.length === 0 && b.passage) {
    const joinedA = sA.map((s) => normalizeSentenceForStrictComparison(s.text)).join(' ');
    const normB = normalizeSentenceForStrictComparison(b.passage);
    return joinedA === normB && joinedA.length > 0;
  }
  if (sB.length > 0 && sA.length === 0 && a.passage) {
    const joinedB = sB.map((s) => normalizeSentenceForStrictComparison(s.text)).join(' ');
    const normA = normalizeSentenceForStrictComparison(a.passage);
    return normA === joinedB && normA.length > 0;
  }

  // 3. Both only have passage: require 100% exact match of normalized passage
  if (a.passage && b.passage) {
    const normA = normalizeSentenceForStrictComparison(a.passage);
    const normB = normalizeSentenceForStrictComparison(b.passage);
    return normA === normB && normA.length > 0;
  }

  // If neither has sentences nor passage, cannot confirm content equivalence
  return false;
}

/**
 * Scans the entire library and identifies duplicate clusters based on strict multi-criteria rules.
 */
export function scanLibraryForDuplicates(
  dictations: SavedDictationItem[],
  teacherClasses: TeacherClass[] = [],
  classAssignments: Record<string, string> = {}
): DuplicateScanReport {
  const clustersMap = new Map<string, SavedDictationItem[]>();

  for (const item of dictations) {
    const isDebate =
      item.group?.toUpperCase() === 'DEBATE' ||
      Boolean(item.level) ||
      /^[Ll][1234]-/i.test(item.lessonCode || '') ||
      Boolean(item.classLevel && /DEBATE/i.test(item.classLevel));

    if (isDebate) {
      // Extract exact Debate Level: 1, 2, 3, or 4
      const level =
        item.level ||
        (item.lessonCode ? item.lessonCode.match(/^[Ll]([1234])-/i)?.[1] : undefined) ||
        (item.classLevel ? item.classLevel.match(/LEVEL\s*([1234])/i)?.[1] : undefined) ||
        '';
      const code = (item.lessonCode || '').trim().toUpperCase();
      const lNum = normalizeLessonNumber(item.lessonNumber) || '';
      const normTitle = normalizeTitle(item.title);

      // Key for Debate: Module + Level + (Code OR Number+Title)
      // Level 1, 2, 3, 4 NEVER mix! Different codes NEVER mix!
      const debateKey = code
        ? `DEBATE|L${level}|CODE_${code}`
        : `DEBATE|L${level}|NUM_${lNum}|TITLE_${normTitle}`;

      const list = clustersMap.get(debateKey) || [];
      list.push(item);
      clustersMap.set(debateKey, list);
    } else {
      // Standard School / English curriculum (Dictation, General, IELTS)
      const group = resolveExistingGroup(item, teacherClasses) || item.group || '';
      const grade = resolveExistingGrade(item, teacherClasses) || item.grade || '';
      const unit =
        normalizeUnit(item.unit) ||
        extractUnitNumber(undefined, item.topic, item.title) ||
        '';
      const lesson =
        normalizeLessonNumber(item.lessonNumber) ||
        extractLessonNumber(undefined, item.title) ||
        '';
      const normTitle = normalizeTitle(item.title);

      const groupNorm = normalizeGroup(group) || (grade ? `LOP${grade}` : '');
      const gradeNorm = getCanonicalGrade(grade) || '';

      const isSchoolDictation =
        Boolean(groupNorm && /MAMNON|LOP\d+/i.test(groupNorm)) ||
        Boolean(gradeNorm) ||
        /Lớp\s*\d+|Grade\s*\d+|KID\s*\d+|Mầm\s*non/i.test(item.classLevel || '');

      if (isSchoolDictation) {
        // Safe canonical cluster key for K-12: GROUP + GRADE + UNIT + LESSON + TITLE
        // Lớp 1 vs Lớp 2 never mix! Unit 1 vs Unit 2 never mix! Lesson 1 vs Lesson 2 never mix!
        const gKey = groupNorm || (gradeNorm ? `LOP${gradeNorm}` : 'DICTATION');
        const key = `DICTATION|${gKey}|G_${gradeNorm}|U_${unit}|L_${lesson}|T_${normTitle}`;
        const list = clustersMap.get(key) || [];
        list.push(item);
        clustersMap.set(key, list);
      } else if (item.group?.toUpperCase() === 'IELTS' || /IELTS/i.test(item.classLevel || '')) {
        const key = `IELTS|U_${unit}|L_${lesson}|T_${normTitle}`;
        const list = clustersMap.get(key) || [];
        list.push(item);
        clustersMap.set(key, list);
      } else {
        // General / Other: Cluster by GROUP/GENERAL + Title
        const genGroup = groupNorm || 'GENERAL';
        const key = `${genGroup}|U_${unit}|L_${lesson}|T_${normTitle}`;
        const list = clustersMap.get(key) || [];
        list.push(item);
        clustersMap.set(key, list);
      }
    }
  }

  const clusters: DuplicateCluster[] = [];
  let confirmedDuplicatesCount = 0;
  let warningItemsCount = 0;
  let totalDuplicateItemsCount = 0;

  // Build a lookup of dictation IDs assigned to classes
  const assignedDictationIds = new Set<string>();
  Object.values(classAssignments).forEach((id) => {
    if (id) assignedDictationIds.add(id);
  });

  clustersMap.forEach((items, key) => {
    if (items.length <= 1) return; // No duplicates in this cluster

    // Sort items to choose KEEP ITEM by strict priority:
    // 1. Item currently assigned to a class (in classAssignments or item.classIds)
    // 2. Item with complete metadata (translation, audio, unit, lesson)
    // 3. Item with most complete content (sentence count, passage length)
    // 4. Earliest createdAt date
    items.sort((a, b) => {
      const aAssigned = (assignedDictationIds.has(a.id) || (a.classIds?.length || 0) > 0) ? 1 : 0;
      const bAssigned = (assignedDictationIds.has(b.id) || (b.classIds?.length || 0) > 0) ? 1 : 0;
      if (aAssigned !== bAssigned) return bAssigned - aAssigned;

      const aMetaScore =
        (a.translation ? 1 : 0) +
        (a.unit ? 1 : 0) +
        (a.unitTitle ? 1 : 0) +
        (a.lessonNumber ? 1 : 0) +
        (a.lessonCode ? 1 : 0);
      const bMetaScore =
        (b.translation ? 1 : 0) +
        (b.unit ? 1 : 0) +
        (b.unitTitle ? 1 : 0) +
        (b.lessonNumber ? 1 : 0) +
        (b.lessonCode ? 1 : 0);
      if (aMetaScore !== bMetaScore) return bMetaScore - aMetaScore;

      const aContentLen = (a.exercise?.sentences?.length || 0) * 100 + (a.passage?.length || 0);
      const bContentLen = (b.exercise?.sentences?.length || 0) * 100 + (b.passage?.length || 0);
      if (aContentLen !== bContentLen) return bContentLen - aContentLen;

      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    const keepItem = items[0];
    const duplicates = items.slice(1);

    const isDebate = key.startsWith('DEBATE');
    const isGeneral = key.startsWith('GENERAL');
    let categoryType: DuplicateCluster['categoryType'] = isDebate
      ? 'DEBATE'
      : isGeneral
      ? 'GENERAL'
      : 'GRADE_LESSON';

    let clusterLabel = '';
    if (isDebate) {
      const lvl =
        keepItem.level ||
        (keepItem.lessonCode ? keepItem.lessonCode.match(/^[Ll]([1234])-/i)?.[1] : '') ||
        '';
      const code = keepItem.lessonCode || `Bài ${keepItem.lessonNumber || ''}`;
      clusterLabel = `Debate Level ${lvl} • ${code}: ${keepItem.title}`;
    } else {
      const g = keepItem.group || keepItem.classLevel || 'Khối lớp';
      const u = keepItem.unit ? `Unit ${keepItem.unit}` : '';
      const l = keepItem.lessonNumber ? `Lesson ${keepItem.lessonNumber}` : '';
      clusterLabel = [g, u, l, keepItem.title].filter(Boolean).join(' • ');
    }

    const duplicateClusterItems: DuplicateClusterItem[] = duplicates.map((dup) => {
      // 100% strict content comparison
      const contentsMatch = areContentsMatching(keepItem, dup);

      // Metadata check: Does this pair have sufficient identification metadata?
      const isMissingCriticalMetadata =
        categoryType === 'GENERAL' && !dup.group && !dup.grade && !dup.classLevel;

      // Duplicate is CONFIRMED ONLY IF contents match 100% AND critical metadata is present
      const isExactMatch = contentsMatch && !isMissingCriticalMetadata;
      const hasContentWarning = !isExactMatch;

      if (hasContentWarning) {
        warningItemsCount++;
      } else {
        confirmedDuplicatesCount++;
      }
      totalDuplicateItemsCount++;

      let similarityReason = '';
      if (isExactMatch) {
        similarityReason = 'Trùng khớp 100% thông tin định danh & toàn bộ từng câu nội dung bài học';
      } else if (!contentsMatch) {
        similarityReason = 'Cảnh báo: Cùng thông tin định danh nhưng nội dung câu hoặc đoạn văn khác nhau';
      } else {
        similarityReason = 'Cảnh báo: Thiếu thông tin định danh khối lớp, cần kiểm tra thủ công';
      }

      return {
        item: dup,
        isKeep: false,
        isExactMatch,
        hasContentWarning,
        similarityReason,
        // Auto-select for deletion ONLY if exact match without any warning
        selectedForDeletion: isExactMatch,
      };
    });

    clusters.push({
      id: `cluster_${key}`,
      label: clusterLabel,
      categoryType,
      groupName: keepItem.group || keepItem.classLevel || 'Khối lớp',
      unit: keepItem.unit,
      lesson: keepItem.lessonNumber,
      lessonCode: keepItem.lessonCode,
      title: keepItem.title,
      keepItem,
      duplicateItems: duplicateClusterItems,
      allCount: items.length,
    });
  });

  return {
    totalScanned: dictations.length,
    duplicateClustersCount: clusters.length,
    totalDuplicateItemsCount,
    confirmedDuplicatesCount,
    warningItemsCount,
    clusters,
  };
}

/**
 * Backs up items before deletion into localStorage, including previous class assignments
 */
export function backupBeforeCleanup(
  deletedItems: SavedDictationItem[],
  previousAssignments: Record<string, string> = {},
  migratedAssignmentsMap: Record<string, string> = {}
): void {
  if (typeof window === 'undefined' || deletedItems.length === 0) return;
  try {
    const backup: CleanupBackupData = {
      timestamp: new Date().toISOString(),
      deletedItems,
      previousAssignments,
      migratedAssignmentsMap,
      restored: false,
    };
    localStorage.setItem(CLEANUP_BACKUP_KEY, JSON.stringify(backup));
  } catch (err) {
    console.error('Failed to create duplicate cleanup backup:', err);
  }
}

/**
 * Gets the latest backup snapshot if available and not yet restored
 */
export function getLatestCleanupBackup(): CleanupBackupData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CLEANUP_BACKUP_KEY);
    if (!raw) return null;
    const parsed: CleanupBackupData = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.deletedItems) || parsed.restored) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Restores the deleted items from the latest backup, including previous class assignments
 */
export function restoreCleanupBackup(
  currentDictations: SavedDictationItem[]
): {
  restoredItems: SavedDictationItem[];
  restoredCount: number;
  previousAssignments?: Record<string, string>;
} | null {
  const backup = getLatestCleanupBackup();
  if (!backup || backup.deletedItems.length === 0) return null;

  const existingIds = new Set(currentDictations.map((d) => d.id));
  const itemsToRestore = backup.deletedItems.filter((d) => !existingIds.has(d.id));

  const updatedList = [...itemsToRestore, ...currentDictations];

  // Mark backup as restored
  try {
    const updatedBackup: CleanupBackupData = {
      ...backup,
      restored: true,
    };
    localStorage.setItem(CLEANUP_BACKUP_KEY, JSON.stringify(updatedBackup));
  } catch {}

  return {
    restoredItems: updatedList,
    restoredCount: itemsToRestore.length,
    previousAssignments: backup.previousAssignments,
  };
}
