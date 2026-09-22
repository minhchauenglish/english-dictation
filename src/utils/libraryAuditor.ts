import { SavedDictationItem, TeacherClass, HomeworkHistoryItem } from '../types';
import {
  normalizeTitle,
  normalizeGroup,
  getCanonicalGrade,
  normalizeUnit,
  normalizeLessonNumber,
  resolveExistingGroup,
  resolveExistingGrade,
  extractUnitNumber,
  extractLessonNumber,
} from './duplicateDetector';
import { classifyExerciseItem } from './libraryFilters';
import { areContentsMatching, getContentSignature } from './libraryDuplicateScanner';

export type DuplicateTier = 'CONFIRMED' | 'POTENTIAL' | 'NONE';

export interface AuditDuplicateItem {
  id: string;
  title: string;
  group?: string;
  grade?: string;
  classLevel: string;
  unit?: string;
  lessonNumber?: string;
  lessonCode?: string;
  level?: string;
  sentenceCount: number;
  contentSnippet: string;
  contentSignature: string;
  fullPassage?: string;
  fullSentences?: string[];
  isKeep: boolean;
  tier: DuplicateTier;
  reason: string;
  statusBadge?: 'CONFIRMED' | 'CONTENT_DUPLICATE_METADATA_DIFF' | 'MANUAL_REVIEW';
  metadataDifference?: string;
  isContentIdentical?: boolean;
  rawItem?: SavedDictationItem;
}

export interface AuditDuplicateCluster {
  clusterId: string;
  module: 'DICTATION' | 'DEBATE' | 'IELTS' | 'GENERAL' | 'OTHER';
  groupKey: string;
  label: string;
  unit?: string;
  lesson?: string;
  lessonCode?: string;
  level?: string;
  normalizedTitle: string;
  items: AuditDuplicateItem[];
  tier: DuplicateTier;
  keepItem: AuditDuplicateItem;
  duplicateItems: AuditDuplicateItem[];
  rawKeepItem?: SavedDictationItem;
}

export interface DataQualityIssue {
  itemId: string;
  title: string;
  issueType:
    | 'MISSING_GROUP'
    | 'MISSING_CLASS_GRADE'
    | 'MISSING_DEBATE_LEVEL'
    | 'MISSING_UNIT'
    | 'MISSING_LESSON_NUMBER'
    | 'MISSING_TITLE'
    | 'EMPTY_CONTENT'
    | 'DUPLICATE_ID'
    | 'CONFLICTING_METADATA';
  description: string;
}

export interface FullLibraryAuditResult {
  auditTimestamp: string;
  totalLessons: number;
  totalClasses: number;
  totalAssignments: number;
  totalHomeworkHistory: number;

  // Breakdown by Module/Group
  moduleCounts: {
    dictation: number;
    debate: number;
    ielts: number;
    general: number;
    other: number;
  };

  // Breakdown by Class/Grade
  gradeCounts: {
    mamNon: number;
    lop1: number;
    lop2: number;
    lop3: number;
    lop4: number;
    lop5: number;
    lop6: number;
    lop7: number;
    lop8: number;
    lop9: number;
    lop10: number;
    lop11: number;
    lop12: number;
  };

  // Debate Program Breakdown
  debateCounts: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    unclassified: number;
    total: number;
  };

  // Lớp 11 Audit
  lop11Audit: {
    total: number;
    units: Record<string, { count: number; lessons: Array<{ id: string; lessonNumber: string; title: string }> }>;
    missingUnits: string[];
  };

  // Duplicate Analysis
  duplicateSummary: {
    totalConfirmedDuplicates: number; // Bản sao dư thừa chắc chắn
    totalPotentialDuplicates: number; // Bản sao nghi vấn cần xem xét
    confirmedClustersCount: number;
    potentialClustersCount: number;
  };

  // Clusters by module
  clustersByModule: {
    DICTATION: AuditDuplicateCluster[];
    DEBATE: AuditDuplicateCluster[];
    IELTS: AuditDuplicateCluster[];
    GENERAL: AuditDuplicateCluster[];
    OTHER: AuditDuplicateCluster[];
  };

  // Unified Duplicate Cluster list and ID sets for precise UI filtering
  allDuplicateClusters: AuditDuplicateCluster[];
  confirmedDuplicateIds: string[];
  potentialDuplicateIds: string[];

  // Data Quality Issues
  dataQualityIssues: DataQualityIssue[];
  duplicateIdsFound: string[];
}

export interface FullLibraryBackupData {
  backupHeader: {
    system: string;
    version: string;
    backupTimestamp: string;
    totalLessons: number;
    totalClasses: number;
    totalAssignments: number;
    totalHomeworkHistory: number;
    summary: {
      dictation: number;
      debate: number;
      ielts: number;
      general: number;
      other: number;
    };
  };
  lessons: SavedDictationItem[];
  classes: TeacherClass[];
  assignments: Record<string, string>;
  homeworkHistory: HomeworkHistoryItem[];
}

/**
 * Normalizes content for strict signature comparison
 */
export function getNormalizedContentSignature(item: SavedDictationItem): string {
  const sentences =
    item.exercise?.sentences?.map((s) => s.text.trim().toLowerCase()).filter(Boolean) || [];

  if (sentences.length > 0) {
    return sentences
      .join(' ')
      .replace(/[^\w\s\u00C0-\u1EF9]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return (item.passage || '')
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u1EF9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to identify module category for any item
 */
export function identifyItemModule(
  item: SavedDictationItem,
  teacherClasses: TeacherClass[] = []
): 'DICTATION' | 'DEBATE' | 'IELTS' | 'GENERAL' | 'OTHER' {
  const isDebate =
    item.group?.toUpperCase() === 'DEBATE' ||
    Boolean(item.level) ||
    /^[Ll][234]-/i.test(item.lessonCode || '') ||
    Boolean(item.classLevel && /DEBATE/i.test(item.classLevel));

  if (isDebate) return 'DEBATE';

  const isIelts =
    item.group?.toUpperCase() === 'IELTS' ||
    Boolean(item.classLevel && /IELTS/i.test(item.classLevel));

  if (isIelts) return 'IELTS';

  const group = resolveExistingGroup(item, teacherClasses) || item.group || '';
  const grade = resolveExistingGrade(item, teacherClasses) || item.grade || '';
  const classL = item.classLevel || '';

  // School grades Mầm non, Lớp 1 -> 12
  const isSchool =
    /MAMNON|LOP\d+/i.test(normalizeGroup(group) || '') ||
    Boolean(getCanonicalGrade(grade)) ||
    /Lớp\s*\d+|Grade\s*\d+|KID\s*\d+|Mầm\s*non/i.test(classL);

  if (isSchool) return 'DICTATION';

  if (/general|chung/i.test(group) || /general/i.test(classL)) {
    return 'GENERAL';
  }

  // Fallback to libraryFilters classification
  const classified = classifyExerciseItem(item, teacherClasses);
  if (classified.mainGroup === 'Debate') return 'DEBATE';
  if (classified.mainGroup === 'IELTS') return 'IELTS';
  if (classified.mainGroup === 'General') return 'GENERAL';
  if (classified.mainGroup.startsWith('Lớp ') || classified.mainGroup === 'Mầm non') {
    return 'DICTATION';
  }

  return 'OTHER';
}

/**
 * Extracts Debate level (1, 2, 3, 4)
 */
export function extractDebateLevel(item: SavedDictationItem): '1' | '2' | '3' | '4' | undefined {
  if (item.level === '1' || item.level === '2' || item.level === '3' || item.level === '4') {
    return item.level;
  }
  const codeMatch = (item.lessonCode || '').match(/^[Ll]([1234])-/i);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1] as '1' | '2' | '3' | '4';
  }
  const classMatch = (item.classLevel || '').match(/LEVEL\s*([1234])/i);
  if (classMatch && classMatch[1]) {
    return classMatch[1] as '1' | '2' | '3' | '4';
  }
  return undefined;
}

/**
 * Performs a comprehensive audit across all lessons, classes, and assignments
 * STRICTLY READ-ONLY: Never alters any source data.
 */
export function runFullLibraryAudit(
  lessons: SavedDictationItem[],
  classes: TeacherClass[] = [],
  assignments: Record<string, string> = {},
  homeworkHistory: HomeworkHistoryItem[] = []
): FullLibraryAuditResult {
  const auditTimestamp = new Date().toISOString();

  // 1. Initial counts
  const moduleCounts = {
    dictation: 0,
    debate: 0,
    ielts: 0,
    general: 0,
    other: 0,
  };

  const gradeCounts = {
    mamNon: 0,
    lop1: 0,
    lop2: 0,
    lop3: 0,
    lop4: 0,
    lop5: 0,
    lop6: 0,
    lop7: 0,
    lop8: 0,
    lop9: 0,
    lop10: 0,
    lop11: 0,
    lop12: 0,
  };

  const debateCounts = {
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    unclassified: 0,
    total: 0,
  };

  const lop11Audit: FullLibraryAuditResult['lop11Audit'] = {
    total: 0,
    units: {},
    missingUnits: [],
  };
  for (let u = 1; u <= 10; u++) {
    lop11Audit.units[`Unit ${u}`] = { count: 0, lessons: [] };
  }

  // 2. Data quality checks
  const dataQualityIssues: DataQualityIssue[] = [];
  const idCounts = new Map<string, number>();

  lessons.forEach((l) => {
    idCounts.set(l.id, (idCounts.get(l.id) || 0) + 1);
  });

  const duplicateIdsFound: string[] = [];
  idCounts.forEach((count, id) => {
    if (count > 1) {
      duplicateIdsFound.push(id);
      dataQualityIssues.push({
        itemId: id,
        title: `ID trùng lặp: ${id}`,
        issueType: 'DUPLICATE_ID',
        description: `Mã ID "${id}" xuất hiện ${count} lần trong danh sách bài học.`,
      });
    }
  });

  // 3. Process each lesson for categorization and quality issues
  lessons.forEach((item) => {
    const mod = identifyItemModule(item, classes);
    if (mod === 'DICTATION') moduleCounts.dictation++;
    else if (mod === 'DEBATE') moduleCounts.debate++;
    else if (mod === 'IELTS') moduleCounts.ielts++;
    else if (mod === 'GENERAL') moduleCounts.general++;
    else moduleCounts.other++;

    // Debate specific audit
    if (mod === 'DEBATE') {
      debateCounts.total++;
      const lvl = extractDebateLevel(item);
      if (lvl === '1') debateCounts.level1++;
      else if (lvl === '2') debateCounts.level2++;
      else if (lvl === '3') debateCounts.level3++;
      else if (lvl === '4') debateCounts.level4++;
      else {
        debateCounts.unclassified++;
        dataQualityIssues.push({
          itemId: item.id,
          title: item.title,
          issueType: 'MISSING_DEBATE_LEVEL',
          description: 'Bài thuộc module Debate nhưng thiếu thông tin Level (2, 3, hoặc 4).',
        });
      }
    }

    // Grade classification
    const groupNorm = normalizeGroup(item.group || '');
    const gradeNorm = getCanonicalGrade(item.grade || '');
    const classClassified = classifyExerciseItem(item, classes);
    const mainG = classClassified.mainGroup;

    if (mainG === 'Mầm non' || groupNorm === 'MAMNON') gradeCounts.mamNon++;
    else if (mainG === 'Lớp 1' || groupNorm === 'LOP1' || gradeNorm === '1') gradeCounts.lop1++;
    else if (mainG === 'Lớp 2' || groupNorm === 'LOP2' || gradeNorm === '2') gradeCounts.lop2++;
    else if (mainG === 'Lớp 3' || groupNorm === 'LOP3' || gradeNorm === '3') gradeCounts.lop3++;
    else if (mainG === 'Lớp 4' || groupNorm === 'LOP4' || gradeNorm === '4') gradeCounts.lop4++;
    else if (mainG === 'Lớp 5' || groupNorm === 'LOP5' || gradeNorm === '5') gradeCounts.lop5++;
    else if (mainG === 'Lớp 6' || groupNorm === 'LOP6' || gradeNorm === '6') gradeCounts.lop6++;
    else if (mainG === 'Lớp 7' || groupNorm === 'LOP7' || gradeNorm === '7') gradeCounts.lop7++;
    else if (mainG === 'Lớp 8' || groupNorm === 'LOP8' || gradeNorm === '8') gradeCounts.lop8++;
    else if (mainG === 'Lớp 9' || groupNorm === 'LOP9' || gradeNorm === '9') gradeCounts.lop9++;
    else if (mainG === 'Lớp 10' || groupNorm === 'LOP10' || gradeNorm === '10') gradeCounts.lop10++;
    else if (mainG === 'Lớp 11' || groupNorm === 'LOP11' || gradeNorm === '11') gradeCounts.lop11++;
    else if (mainG === 'Lớp 12' || groupNorm === 'LOP12' || gradeNorm === '12') gradeCounts.lop12++;

    // Lớp 11 detailed check
    const isLop11 =
      groupNorm === 'LOP11' ||
      gradeNorm === '11' ||
      mainG === 'Lớp 11' ||
      /Lớp\s*11|Grade\s*11/i.test(item.classLevel || '');

    if (isLop11) {
      lop11Audit.total++;
      const uNum =
        normalizeUnit(item.unit) ||
        extractUnitNumber(undefined, item.topic, item.title) ||
        'Khác';
      const uKey = uNum !== 'Khác' ? `Unit ${parseInt(uNum, 10)}` : 'Khác';
      if (!lop11Audit.units[uKey]) {
        lop11Audit.units[uKey] = { count: 0, lessons: [] };
      }
      lop11Audit.units[uKey].count++;
      lop11Audit.units[uKey].lessons.push({
        id: item.id,
        lessonNumber: item.lessonNumber || '',
        title: item.title,
      });
    }

    // Quality: Empty content
    const sentenceCount = item.exercise?.sentences?.length || 0;
    const hasPassage = Boolean(item.passage && item.passage.trim().length > 0);
    if (sentenceCount === 0 && !hasPassage) {
      dataQualityIssues.push({
        itemId: item.id,
        title: item.title || '(Không có tiêu đề)',
        issueType: 'EMPTY_CONTENT',
        description: 'Bài học không có câu luyện nghe (sentences rỗng) và không có đoạn văn (passage rỗng).',
      });
    }

    // Quality: Empty title
    if (!item.title || !item.title.trim()) {
      dataQualityIssues.push({
        itemId: item.id,
        title: '(Tiêu đề rỗng)',
        issueType: 'MISSING_TITLE',
        description: 'Bài học thiếu tiêu đề bài học.',
      });
    }

    // Quality: Missing group or class
    if (!item.group && !item.classLevel) {
      dataQualityIssues.push({
        itemId: item.id,
        title: item.title,
        issueType: 'MISSING_GROUP',
        description: 'Bài học thiếu cả thông tin GROUP và CLASS_LEVEL.',
      });
    }
  });

  // Calculate missing Lớp 11 units
  for (let u = 1; u <= 10; u++) {
    const key = `Unit ${u}`;
    if (!lop11Audit.units[key] || lop11Audit.units[key].count === 0) {
      lop11Audit.missingUnits.push(key);
    }
  }

  // 4. Duplicate Detection Engine across ALL modules
  const rawClustersMap = new Map<string, SavedDictationItem[]>();

  lessons.forEach((item) => {
    const mod = identifyItemModule(item, classes);

    if (mod === 'DEBATE') {
      const lvl = extractDebateLevel(item) || '0';
      const code = (item.lessonCode || '').trim().toUpperCase();
      const normT = normalizeTitle(item.title);
      const lNum = normalizeLessonNumber(item.lessonNumber) || '';

      // Primary key: DEBATE|Lvl|Code or DEBATE|Lvl|Num|Title
      const key = code
        ? `DEBATE|L${lvl}|CODE_${code}`
        : `DEBATE|L${lvl}|NUM_${lNum}|TITLE_${normT}`;

      const list = rawClustersMap.get(key) || [];
      list.push(item);
      rawClustersMap.set(key, list);
    } else if (mod === 'DICTATION') {
      const group = resolveExistingGroup(item, classes) || item.group || '';
      const grade = resolveExistingGrade(item, classes) || item.grade || '';
      const gKey = normalizeGroup(group) || (grade ? `LOP${grade}` : 'SCHOOL');
      const uNum =
        normalizeUnit(item.unit) ||
        extractUnitNumber(undefined, item.topic, item.title) ||
        '';
      const lNum =
        normalizeLessonNumber(item.lessonNumber) ||
        extractLessonNumber(undefined, item.title) ||
        '';
      const normT = normalizeTitle(item.title);

      const key = `DICTATION|${gKey}|U_${uNum}|L_${lNum}|T_${normT}`;
      const list = rawClustersMap.get(key) || [];
      list.push(item);
      rawClustersMap.set(key, list);
    } else if (mod === 'IELTS') {
      const normT = normalizeTitle(item.title);
      const key = `IELTS|${normT}`;
      const list = rawClustersMap.get(key) || [];
      list.push(item);
      rawClustersMap.set(key, list);
    } else {
      // GENERAL / OTHER
      const normT = normalizeTitle(item.title);
      const key = `${mod}|${normT}`;
      const list = rawClustersMap.get(key) || [];
      list.push(item);
      rawClustersMap.set(key, list);
    }
  });

  // Group raw clusters into 3 Tiers
  const clustersByModule: FullLibraryAuditResult['clustersByModule'] = {
    DICTATION: [],
    DEBATE: [],
    IELTS: [],
    GENERAL: [],
    OTHER: [],
  };

  let totalConfirmedDuplicates = 0;
  let totalPotentialDuplicates = 0;
  let confirmedClustersCount = 0;
  let potentialClustersCount = 0;
  const allDuplicateClusters: AuditDuplicateCluster[] = [];
  const confirmedDuplicateIds: string[] = [];
  const potentialDuplicateIds: string[] = [];

  const assignedDictationIds = new Set<string>();
  Object.values(assignments).forEach((id) => {
    if (id) assignedDictationIds.add(id);
  });

  rawClustersMap.forEach((rawItems, rawKey) => {
    if (rawItems.length <= 1) return; // Không trùng (No duplicates)

    // Sort items to prioritize which one to KEEP:
    // 1. Has class assigned (via classAssignments or classIds)
    // 2. More complete metadata (translation, unit, lessonNumber, audioUrl)
    // 3. More complete content (sentences count, passage length)
    // 4. Earliest createdAt date
    const sorted = [...rawItems].sort((a, b) => {
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

      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    const keepRaw = sorted[0];
    const mod = identifyItemModule(keepRaw, classes);

    const auditItems: AuditDuplicateItem[] = sorted.map((it, idx) => {
      const isKeep = idx === 0;
      const sig = getContentSignature(it);
      let tier: DuplicateTier = 'NONE';
      let reason = '';
      let statusBadge: 'CONFIRMED' | 'CONTENT_DUPLICATE_METADATA_DIFF' | 'MANUAL_REVIEW' | undefined = undefined;
      let metadataDifference = '';
      const contentMatch = isKeep ? true : areContentsMatching(keepRaw, it);

      if (isKeep) {
        tier = 'NONE';
        reason = 'Bản gốc ưu tiên giữ lại (tạo sớm nhất, có bài tập/metadata đầy đủ hơn hoặc đã gán lớp học).';
      } else {
        const keepLessonNum =
          normalizeLessonNumber(keepRaw.lessonNumber) ||
          extractLessonNumber(undefined, keepRaw.title) ||
          '';
        const itLessonNum =
          normalizeLessonNumber(it.lessonNumber) ||
          extractLessonNumber(undefined, it.title) ||
          '';
        const hasDifferentLessonNumber = Boolean(
          keepLessonNum && itLessonNum && keepLessonNum !== itLessonNum
        );

        const keepUnitNum =
          normalizeUnit(keepRaw.unit) ||
          extractUnitNumber(undefined, keepRaw.topic, keepRaw.title) ||
          '';
        const itUnitNum =
          normalizeUnit(it.unit) ||
          extractUnitNumber(undefined, it.topic, it.title) ||
          '';
        const hasDifferentUnit = Boolean(
          keepUnitNum && itUnitNum && keepUnitNum !== itUnitNum
        );

        const isMissingCriticalMetadata =
          mod === 'GENERAL' && !it.group && !it.grade && !it.classLevel;

        const diffs: string[] = [];
        if (hasDifferentLessonNumber) {
          diffs.push(`Lesson: ${keepLessonNum ? `Lesson ${keepLessonNum}` : 'N/A'} (KEEP) vs ${itLessonNum ? `Lesson ${itLessonNum}` : 'N/A'} (DUP)`);
        }
        if (hasDifferentUnit) {
          diffs.push(`Unit: ${keepUnitNum ? `Unit ${keepUnitNum}` : 'N/A'} (KEEP) vs ${itUnitNum ? `Unit ${itUnitNum}` : 'N/A'} (DUP)`);
        }
        metadataDifference = diffs.join(', ');

        if (contentMatch) {
          if (hasDifferentLessonNumber || hasDifferentUnit) {
            tier = 'POTENTIAL';
            statusBadge = 'CONTENT_DUPLICATE_METADATA_DIFF';
            reason = `CONTENT DUPLICATE — METADATA DIFFERENT: Nội dung giống nhau 100% nhưng số bài hoặc Unit khác nhau (${metadataDifference || 'khác metadata'}). Chuyển sang MANUAL REVIEW, không tự động xóa.`;
          } else if (isMissingCriticalMetadata) {
            tier = 'POTENTIAL';
            statusBadge = 'MANUAL_REVIEW';
            reason = 'MANUAL REVIEW: Cảnh báo thiếu thông tin định danh khối lớp, cần kiểm duyệt thủ công.';
          } else {
            tier = 'CONFIRMED';
            statusBadge = 'CONFIRMED';
            reason = '100% content match after normalization.';
          }
        } else {
          tier = 'POTENTIAL';
          statusBadge = 'MANUAL_REVIEW';
          reason = 'MANUAL REVIEW: Cùng thông tin định danh nhưng nội dung bài tập hoặc câu nghe có sự khác biệt giữa hai bản.';
        }
      }

      const rawSnippet = it.passage || (it.exercise?.sentences?.map((s) => s.text).join(' ') || '');
      const contentSnippet = rawSnippet.length > 200 ? `${rawSnippet.slice(0, 200)}...` : rawSnippet;
      const fullSentences = it.exercise?.sentences?.map((s) => s.text) || [];
      const fullPassage = it.passage || '';

      return {
        id: it.id,
        title: it.title,
        group: it.group,
        grade: it.grade,
        classLevel: it.classLevel,
        unit: it.unit,
        lessonNumber: it.lessonNumber,
        lessonCode: it.lessonCode,
        level: it.level,
        sentenceCount: it.exercise?.sentences?.length || 0,
        contentSnippet: contentSnippet || 'Không có văn bản đoạn nghe',
        contentSignature: sig,
        fullPassage,
        fullSentences,
        isKeep,
        tier,
        reason,
        statusBadge,
        metadataDifference,
        isContentIdentical: contentMatch,
        rawItem: it,
      };
    });

    const duplicateItems = auditItems.filter((i) => !i.isKeep);
    const hasConfirmed = duplicateItems.some((i) => i.tier === 'CONFIRMED');
    const clusterTier: DuplicateTier = hasConfirmed ? 'CONFIRMED' : 'POTENTIAL';

    if (clusterTier === 'CONFIRMED') {
      confirmedClustersCount++;
    } else {
      potentialClustersCount++;
    }

    duplicateItems.forEach((d) => {
      if (d.tier === 'CONFIRMED') {
        totalConfirmedDuplicates++;
        confirmedDuplicateIds.push(d.id);
      } else if (d.tier === 'POTENTIAL') {
        totalPotentialDuplicates++;
        potentialDuplicateIds.push(d.id);
      }
    });

    const cluster: AuditDuplicateCluster = {
      clusterId: rawKey,
      module: mod,
      groupKey: rawKey,
      label: keepRaw.title,
      unit: keepRaw.unit,
      lesson: keepRaw.lessonNumber,
      lessonCode: keepRaw.lessonCode,
      level: keepRaw.level,
      normalizedTitle: normalizeTitle(keepRaw.title),
      items: auditItems,
      tier: clusterTier,
      keepItem: auditItems[0],
      duplicateItems,
      rawKeepItem: keepRaw,
    };

    clustersByModule[mod].push(cluster);
    allDuplicateClusters.push(cluster);
  });

  return {
    auditTimestamp,
    totalLessons: lessons.length,
    totalClasses: classes.length,
    totalAssignments: Object.keys(assignments).length,
    totalHomeworkHistory: homeworkHistory.length,
    moduleCounts,
    gradeCounts,
    debateCounts,
    lop11Audit,
    duplicateSummary: {
      totalConfirmedDuplicates,
      totalPotentialDuplicates,
      confirmedClustersCount,
      potentialClustersCount,
    },
    clustersByModule,
    allDuplicateClusters,
    confirmedDuplicateIds,
    potentialDuplicateIds,
    dataQualityIssues,
    duplicateIdsFound,
  };
}

/**
 * Creates a clean backup snapshot data structure
 */
export function createFullLibraryBackup(
  lessons: SavedDictationItem[],
  classes: TeacherClass[] = [],
  assignments: Record<string, string> = {},
  homeworkHistory: HomeworkHistoryItem[] = []
): FullLibraryBackupData {
  const audit = runFullLibraryAudit(lessons, classes, assignments, homeworkHistory);

  return {
    backupHeader: {
      system: 'English Dictation App - Library Backup',
      version: '1.0.0',
      backupTimestamp: new Date().toISOString(),
      totalLessons: lessons.length,
      totalClasses: classes.length,
      totalAssignments: Object.keys(assignments).length,
      totalHomeworkHistory: homeworkHistory.length,
      summary: audit.moduleCounts,
    },
    lessons,
    classes,
    assignments,
    homeworkHistory,
  };
}

/**
 * Triggers client-side browser JSON download
 */
export function downloadBackupJSON(backupData: FullLibraryBackupData, customFileName?: string): void {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
  const fileName = customFileName || `dictation_app_full_backup_${dateStr}.json`;

  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formats a clean, readable text report matching the user's exact specification
 */
export function generateAuditTextReport(
  audit: FullLibraryAuditResult,
  backupHeader: FullLibraryBackupData['backupHeader']
): string {
  const lines: string[] = [];

  lines.push('==================================================');
  lines.push('BÁO CÁO AUDIT & BACKUP TOÀN BỘ THƯ VIỆN');
  lines.push('==================================================');
  lines.push(`Thời gian thực hiện audit: ${audit.auditTimestamp}`);
  lines.push(`Trạng thái thao tác: READ-ONLY (TUYỆT ĐỐI KHÔNG XÓA DỮ LIỆU)`);
  lines.push('');

  lines.push('==================================================');
  lines.push('1. THỐNG KÊ TỔNG THỂ');
  lines.push('==================================================');
  lines.push(`TOTAL LESSONS: ${audit.totalLessons}`);
  lines.push(`TOTAL CLASSES: ${audit.totalClasses}`);
  lines.push(`TOTAL ASSIGNMENTS: ${audit.totalAssignments}`);
  lines.push(`TOTAL HOMEWORK HISTORY: ${audit.totalHomeworkHistory}`);
  lines.push('');

  lines.push('THEO MODULE / GROUP:');
  lines.push(`- Dictation (Chương trình phổ thông): ${audit.moduleCounts.dictation}`);
  lines.push(`- Debate (Tranh biện tiếng Anh): ${audit.moduleCounts.debate}`);
  lines.push(`- IELTS: ${audit.moduleCounts.ielts}`);
  lines.push(`- General: ${audit.moduleCounts.general}`);
  lines.push(`- Other: ${audit.moduleCounts.other}`);
  lines.push('');

  lines.push('THEO CLASS / GRADE:');
  lines.push(`- Mầm non: ${audit.gradeCounts.mamNon}`);
  lines.push(`- Lớp 1: ${audit.gradeCounts.lop1}`);
  lines.push(`- Lớp 2: ${audit.gradeCounts.lop2}`);
  lines.push(`- Lớp 3: ${audit.gradeCounts.lop3}`);
  lines.push(`- Lớp 4: ${audit.gradeCounts.lop4}`);
  lines.push(`- Lớp 5: ${audit.gradeCounts.lop5}`);
  lines.push(`- Lớp 6: ${audit.gradeCounts.lop6}`);
  lines.push(`- Lớp 7: ${audit.gradeCounts.lop7}`);
  lines.push(`- Lớp 8: ${audit.gradeCounts.lop8}`);
  lines.push(`- Lớp 9: ${audit.gradeCounts.lop9}`);
  lines.push(`- Lớp 10: ${audit.gradeCounts.lop10}`);
  lines.push(`- Lớp 11: ${audit.gradeCounts.lop11}`);
  lines.push(`- Lớp 12: ${audit.gradeCounts.lop12}`);
  lines.push('');

  lines.push('DEBATE PROGRAM:');
  lines.push(`- Level 1: ${audit.debateCounts.level1}`);
  lines.push(`- Level 2: ${audit.debateCounts.level2}`);
  lines.push(`- Level 3: ${audit.debateCounts.level3}`);
  lines.push(`- Level 4: ${audit.debateCounts.level4}`);
  lines.push(`- Chưa phân Level: ${audit.debateCounts.unclassified}`);
  lines.push(`- Tổng Debate: ${audit.debateCounts.total}`);
  lines.push('');

  lines.push('KIỂM TRA RIÊNG LỚP 11:');
  lines.push(`- Lớp 11 Total: ${audit.lop11Audit.total}`);
  Object.keys(audit.lop11Audit.units)
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 999;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 999;
      return numA - numB;
    })
    .forEach((uKey) => {
      const info = audit.lop11Audit.units[uKey];
      lines.push(`  * ${uKey}: ${info.count} lessons`);
    });
  if (audit.lop11Audit.missingUnits.length > 0) {
    lines.push(`  ⚠️ Units còn thiếu bài: ${audit.lop11Audit.missingUnits.join(', ')}`);
  }
  lines.push('');

  lines.push('==================================================');
  lines.push('2. BACKUP ĐÃ TẠO SẴN SÀNG');
  lines.push('==================================================');
  lines.push(`BACKUP`);
  lines.push(`Date/time: ${backupHeader.backupTimestamp}`);
  lines.push(`Total lessons: ${backupHeader.totalLessons}`);
  lines.push(`Total classes: ${backupHeader.totalClasses}`);
  lines.push(`Total assignments: ${backupHeader.totalAssignments}`);
  lines.push(`Total Debate: ${backupHeader.summary.debate}`);
  lines.push(`Total Dictation: ${backupHeader.summary.dictation}`);
  lines.push(`Total IELTS: ${backupHeader.summary.ielts}`);
  lines.push(`Total General: ${backupHeader.summary.general}`);
  lines.push(`Tình trạng dữ liệu gốc: Giữ nguyên 100%`);
  lines.push(`File JSON: Có thể xuất tải về máy bất cứ lúc nào qua nút "Tải file Backup JSON"`);
  lines.push('');

  lines.push('==================================================');
  lines.push('3. TỔNG HỢP DUPLICATE (PHÂN 3 MỨC)');
  lines.push('==================================================');
  lines.push(`- Tổng duplicate CHẮC CHẮN (có thể xóa sau khi xác nhận): ${audit.duplicateSummary.totalConfirmedDuplicates} bản sao (thuộc ${audit.duplicateSummary.confirmedClustersCount} cụm bài trùng)`);
  lines.push(`- Tổng duplicate CÓ KHẢ NĂNG TRÙNG (cần xem xét thủ công): ${audit.duplicateSummary.totalPotentialDuplicates} bản sao (thuộc ${audit.duplicateSummary.potentialClustersCount} cụm bài)`);
  lines.push(`- Các bài KHÔNG TRÙNG: Đã bảo vệ an toàn, không đưa vào danh sách`);
  lines.push('');

  const renderModuleClusters = (modName: keyof FullLibraryAuditResult['clustersByModule'], label: string) => {
    const clusters = audit.clustersByModule[modName];
    lines.push('========================');
    lines.push(`${label} DUPLICATES (${clusters.length} cụm trùng)`);
    lines.push('========================');
    if (clusters.length === 0) {
      lines.push('Không phát hiện bài trùng lặp trong module này.\n');
      return;
    }

    clusters.forEach((c, idx) => {
      lines.push(`Cụm ${idx + 1}: ${c.label}`);
      if (c.unit) lines.push(`Unit: ${c.unit}`);
      if (c.lesson) lines.push(`Lesson: ${c.lesson}`);
      if (c.lessonCode) lines.push(`Code: ${c.lessonCode}`);
      if (c.level) lines.push(`Level: ${c.level}`);
      lines.push(`Tổng bản ghi tìm thấy: ${c.items.length}`);
      lines.push(`- Giữ lại (Bản gốc): [ID: ${c.keepItem.id}] "${c.keepItem.title}" (${c.keepItem.sentenceCount} câu)`);
      c.duplicateItems.forEach((d) => {
        lines.push(`- Bản sao [${d.tier === 'CONFIRMED' ? 'DUPLICATE CHẮC CHẮN' : 'CÓ KHẢ NĂNG TRÙNG'}]: [ID: ${d.id}] "${d.title}" (${d.sentenceCount} câu)`);
        lines.push(`  Lý do: ${d.reason}`);
      });
      lines.push('');
    });
  };

  renderModuleClusters('DICTATION', 'DICTATION');
  renderModuleClusters('DEBATE', 'DEBATE');
  renderModuleClusters('IELTS', 'IELTS');
  renderModuleClusters('GENERAL', 'GENERAL');
  renderModuleClusters('OTHER', 'OTHER');

  lines.push('==================================================');
  lines.push('4. KIỂM TRA CHẤT LƯỢNG DỮ LIỆU (DATA QUALITY ISSUES)');
  lines.push('==================================================');
  if (audit.dataQualityIssues.length === 0) {
    lines.push('Không phát hiện vấn đề dữ liệu nào. Tất cả bài học đều đầy đủ metadata và nội dung.');
  } else {
    lines.push(`Tổng số vấn đề phát hiện: ${audit.dataQualityIssues.length}`);
    audit.dataQualityIssues.slice(0, 30).forEach((issue, idx) => {
      lines.push(`${idx + 1}. [${issue.issueType}] Bài "${issue.title}" (ID: ${issue.itemId}): ${issue.description}`);
    });
    if (audit.dataQualityIssues.length > 30) {
      lines.push(`... và ${audit.dataQualityIssues.length - 30} vấn đề khác.`);
    }
  }
  lines.push('');

  return lines.join('\n');
}
