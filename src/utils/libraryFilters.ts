import { SavedDictationItem, TeacherClass } from '../types';

/**
 * EXACT 16 PERMANENT MAIN GROUPS IN FIXED ORDER:
 * 1. Mầm non
 * 2. Lớp 1
 * 3. Lớp 2
 * 4. Lớp 3
 * 5. Lớp 4
 * 6. Lớp 5
 * 7. Lớp 6
 * 8. Lớp 7
 * 9. Lớp 8
 * 10. Lớp 9
 * 11. Lớp 10
 * 12. Lớp 11
 * 13. Lớp 12
 * 14. Debate
 * 15. IELTS
 * 16. General
 */
export const PERMANENT_MAIN_GROUPS = [
  'Mầm non',
  'Lớp 1',
  'Lớp 2',
  'Lớp 3',
  'Lớp 4',
  'Lớp 5',
  'Lớp 6',
  'Lớp 7',
  'Lớp 8',
  'Lớp 9',
  'Lớp 10',
  'Lớp 11',
  'Lớp 12',
  'Debate',
  'IELTS',
  'General',
] as const;

export type PermanentMainGroup = (typeof PERMANENT_MAIN_GROUPS)[number];

export interface LevelFilterClassification {
  mainGroup: string; // Must be one of PERMANENT_MAIN_GROUPS
  subLevel?: string; // Optional sublevel (e.g. "Level 1 • Từ đơn", "Level 1", "Speaking")
  displayClassLabel?: string; // Friendly display label for UI badges
}

export interface SubLevelItem {
  key: string;
  label: string;
  count: number;
}

export interface MainGroupItem {
  key: string;
  label: string;
  count: number;
  subLevels: SubLevelItem[];
}

/**
 * Normalizes Vietnamese string removing diacritics for robust matching
 */
export function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Priority A: Resolves main category from explicit GROUP field if present
 */
function resolveMainGroupFromGroupField(groupStr?: string): string | undefined {
  if (!groupStr || !groupStr.trim()) return undefined;
  const raw = groupStr.trim();
  const norm = removeDiacritics(raw).toLowerCase();

  if (
    norm.includes('mam non') ||
    norm.includes('preschool') ||
    norm.includes('kindergarten')
  ) {
    return 'Mầm non';
  }

  // Check 10, 11, 12 before 1-9
  const gradeMatch =
    norm.match(/(?:lop|grade|khoi)\s*(1[0-2]|[1-9])(?:\b|[a-zA-Z])/i) ||
    norm.match(/^(?:lop|grade|khoi)?\s*(1[0-2]|[1-9])$/i);

  if (gradeMatch && gradeMatch[1]) {
    return `Lớp ${gradeMatch[1]}`;
  }

  if (norm.includes('debate')) return 'Debate';
  if (norm.includes('ielts')) return 'IELTS';
  if (norm.includes('general') || norm.includes('chung')) return 'General';

  return undefined;
}

/**
 * Priority B: Resolves main category from GRADE field if present
 */
function resolveMainGroupFromGradeField(gradeStr?: string): string | undefined {
  if (!gradeStr || !gradeStr.trim()) return undefined;
  const raw = gradeStr.trim();
  const norm = removeDiacritics(raw).toLowerCase();

  if (
    norm.includes('mam non') ||
    norm.includes('preschool') ||
    norm.includes('kindergarten')
  ) {
    return 'Mầm non';
  }

  // GRADE: 1 .. 12, Grade 1 .. 12, Khối 1 .. 12, Lớp 1 .. 12
  const gradeMatch =
    norm.match(/(?:grade|lop|khoi)?\s*(1[0-2]|[1-9])(?:\b|[a-zA-Z])/i) ||
    norm.match(/^(1[0-2]|[1-9])$/);

  if (gradeMatch && gradeMatch[1]) {
    return `Lớp ${gradeMatch[1]}`;
  }

  if (norm.includes('debate')) return 'Debate';
  if (norm.includes('ielts')) return 'IELTS';

  return undefined;
}

/**
 * Priority C: Resolves main category from CLASS field
 */
function resolveMainGroupFromClassField(classStr?: string): string | undefined {
  if (!classStr || !classStr.trim()) return undefined;
  const raw = classStr.trim();
  const norm = removeDiacritics(raw).toLowerCase();

  // Mầm non check
  if (
    norm.includes('mam non') ||
    norm.includes('preschool') ||
    norm.includes('kindergarten')
  ) {
    return 'Mầm non';
  }

  // Preschool level check e.g. "LEVEL 1 – TỪ ĐƠN" when data belongs to preschool
  if (
    /^level\s*[1-3]\b/i.test(norm) &&
    (norm.includes('tu don') ||
      norm.includes('cum tu') ||
      norm.includes('cau ngan') ||
      norm.includes('words') ||
      norm.includes('sentences'))
  ) {
    return 'Mầm non';
  }

  // Debate check (e.g. "DEBATE", "DEBATE LEVEL 1", "DEBATE LEVEL 2")
  if (norm.includes('debate')) {
    return 'Debate';
  }

  // IELTS check (e.g. "IELTS", "IELTS SPEAKING", "IELTS LISTENING")
  if (norm.includes('ielts')) {
    return 'IELTS';
  }

  // KID classes: KID1A, KID1B, KID 1 -> Lớp 1; KID2A, KID2B, KID 2 -> Lớp 2; etc.
  const kidMatch = norm.match(/kid\s*([0-9]+)/i);
  if (kidMatch && kidMatch[1]) {
    const kidNum = parseInt(kidMatch[1], 10);
    if (kidNum >= 1 && kidNum <= 12) {
      return `Lớp ${kidNum}`;
    }
  }

  // Standard Grades 1 - 12:
  // "Grade 3", "Lớp 3", "GRADE 4A", "Lớp 10", "10A", "11B", "12A", "1A"
  // Note: Check 10, 11, 12 before 1-9 to avoid 10 being parsed as 1
  const gradeMatch =
    norm.match(/(?:grade|lop|khoi)\s*(1[0-2]|[1-9])(?:\b|[a-zA-Z])/i) ||
    raw.match(/^(?:grade|lop|lớp|khoi|khối)\s*(1[0-2]|[1-9])(?:\b|[a-zA-Z])/i) ||
    raw.match(/^(1[0-2]|[1-9])[a-zA-Z]/);

  if (gradeMatch && gradeMatch[1]) {
    return `Lớp ${gradeMatch[1]}`;
  }

  return undefined;
}

/**
 * Extracts optional sublevel according to category type:
 * - Mầm non: Level 1 • Từ đơn, Level 2 • Cụm từ, Level 3 • Câu ngắn
 * - Debate: Level 1, Level 2, Level 3, ...
 * - IELTS: Speaking, Listening, Reading, Writing
 */
function extractSubLevel(mainGroup: string, rawText: string): string | undefined {
  const norm = removeDiacritics(rawText).toLowerCase();

  if (mainGroup === 'Mầm non') {
    if (
      norm.includes('level 1') ||
      norm.includes('tu don') ||
      norm.includes('single word') ||
      norm.includes('words')
    ) {
      return 'Level 1 • Từ đơn';
    }
    if (
      norm.includes('level 2') ||
      norm.includes('cum tu') ||
      norm.includes('phrases')
    ) {
      return 'Level 2 • Cụm từ';
    }
    if (
      norm.includes('level 3') ||
      norm.includes('cau ngan') ||
      norm.includes('short sentence') ||
      norm.includes('sentences')
    ) {
      return 'Level 3 • Câu ngắn';
    }
    return undefined;
  }

  if (mainGroup === 'Debate') {
    const codeMatch = rawText.match(/\b[Ll]([234])-\d{2,4}\b/i);
    if (codeMatch && codeMatch[1]) {
      return `Level ${codeMatch[1]}`;
    }
    const lvlMatch = rawText.match(/level\s*(\d+)/i) || norm.match(/cap\s*do\s*(\d+)/i);
    if (lvlMatch && lvlMatch[1]) {
      return `Level ${lvlMatch[1]}`;
    }
    return undefined;
  }

  if (mainGroup === 'IELTS') {
    if (norm.includes('speaking') || norm.includes('noi')) return 'Speaking';
    if (norm.includes('listening') || norm.includes('nghe')) return 'Listening';
    if (norm.includes('reading') || norm.includes('doc')) return 'Reading';
    if (norm.includes('writing') || norm.includes('viet')) return 'Writing';
    return undefined;
  }

  return undefined;
}

/**
 * Classifies a complete SavedDictationItem with Priority:
 * A. Explicit GROUP field if present
 * B. GRADE field
 * C. CLASS field
 * D. Existing known category
 * E. Fallback to General
 */
export function classifyExerciseItem(
  item: SavedDictationItem,
  teacherClasses: TeacherClass[] = []
): LevelFilterClassification {
  // A. Explicit GROUP field or Debate check
  let mainGroup = resolveMainGroupFromGroupField(item.group);

  // Direct Debate classification guarantee:
  if (
    !mainGroup &&
    (Boolean(item.level) ||
      /^[Ll][234]-/i.test(item.lessonCode || '') ||
      Boolean(item.group && /DEBATE/i.test(item.group)) ||
      Boolean(item.classLevel && /DEBATE/i.test(item.classLevel)))
  ) {
    mainGroup = 'Debate';
  }

  // B. GRADE field
  if (!mainGroup) {
    mainGroup = resolveMainGroupFromGradeField(item.grade);
  }

  // C. CLASS field (item.classLevel)
  const rawClassLevel = item.classLevel?.trim() || '';
  if (!mainGroup && rawClassLevel) {
    const parts = rawClassLevel.split(',').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const resolved = resolveMainGroupFromClassField(part);
      if (resolved) {
        mainGroup = resolved;
        break;
      }
    }
  }

  // Also check assigned classes from teacherClasses
  if (!mainGroup && item.classIds && item.classIds.length > 0) {
    for (const cid of item.classIds) {
      const tc = teacherClasses.find((c) => c.id === cid);
      if (tc) {
        if (tc.gradeLevel) {
          const mg =
            resolveMainGroupFromGradeField(tc.gradeLevel) ||
            resolveMainGroupFromClassField(tc.gradeLevel);
          if (mg) {
            mainGroup = mg;
            break;
          }
        }
        if (tc.name) {
          const mc = resolveMainGroupFromClassField(tc.name);
          if (mc) {
            mainGroup = mc;
            break;
          }
        }
      }
    }
  }

  // D. Existing known category check on rawClassLevel
  if (!mainGroup && rawClassLevel) {
    const mg = resolveMainGroupFromGroupField(rawClassLevel);
    if (mg) {
      mainGroup = mg;
    }
  }

  // E. Fallback to General
  if (!mainGroup || !PERMANENT_MAIN_GROUPS.includes(mainGroup as any)) {
    mainGroup = 'General';
  }

  // Sublevel extraction
  let subLevel: string | undefined;
  if (mainGroup === 'Debate') {
    if (item.level) {
      subLevel = `Level ${item.level}`;
    } else if (item.lessonCode) {
      const m = item.lessonCode.match(/^[Ll]([234])-/i);
      if (m) subLevel = `Level ${m[1]}`;
    }
  }
  if (!subLevel) {
    const searchSource = `${item.level ? `Level ${item.level}` : ''} ${item.lessonCode || ''} ${item.group || ''} ${item.grade || ''} ${rawClassLevel} ${item.topic || ''} ${item.title || ''}`;
    subLevel = extractSubLevel(mainGroup, searchSource);
  }

  return {
    mainGroup,
    subLevel,
    displayClassLabel:
      subLevel || (mainGroup !== 'General' ? mainGroup : rawClassLevel || 'General'),
  };
}

/**
 * Classifies a raw classLevel / className string into a main group and optional sublevel.
 * Strictly guarantees mainGroup is one of PERMANENT_MAIN_GROUPS.
 */
export function classifyClassLevel(raw: string): LevelFilterClassification {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { mainGroup: 'General', displayClassLabel: 'General' };
  }

  let mainGroup =
    resolveMainGroupFromGroupField(trimmed) ||
    resolveMainGroupFromGradeField(trimmed) ||
    resolveMainGroupFromClassField(trimmed);

  if (!mainGroup || !PERMANENT_MAIN_GROUPS.includes(mainGroup as any)) {
    mainGroup = 'General';
  }

  const subLevel = extractSubLevel(mainGroup, trimmed);

  return {
    mainGroup,
    subLevel,
    displayClassLabel:
      subLevel || (mainGroup !== 'General' ? mainGroup : trimmed),
  };
}

/**
 * Derives the list of main groups and sublevels from the current library items.
 * Strictly guarantees:
 * - ALWAYS shows all 16 PERMANENT_MAIN_GROUPS on the UI in fixed order (even when count is 0).
 * - For groups with no items, count = 0 and subLevels = [].
 * - Accurately counts exercises in each main group and sublevel from actual data.
 */
export function buildLibraryFilterHierarchy(
  dictations: SavedDictationItem[],
  teacherClasses: TeacherClass[] = []
): MainGroupItem[] {
  const groupsMap = new Map<
    string,
    {
      dictationIds: Set<string>;
      subLevelsMap: Map<string, Set<string>>;
    }
  >();

  // Process all dictation items
  dictations.forEach((d) => {
    const { mainGroup, subLevel } = classifyExerciseItem(d, teacherClasses);

    if (!groupsMap.has(mainGroup)) {
      groupsMap.set(mainGroup, {
        dictationIds: new Set(),
        subLevelsMap: new Map(),
      });
    }

    const groupRecord = groupsMap.get(mainGroup)!;
    groupRecord.dictationIds.add(d.id);

    if (subLevel) {
      if (!groupRecord.subLevelsMap.has(subLevel)) {
        groupRecord.subLevelsMap.set(subLevel, new Set());
      }
      groupRecord.subLevelsMap.get(subLevel)!.add(d.id);
    }
  });

  // Construct results strictly following PERMANENT_MAIN_GROUPS order.
  // ALWAYS includes all 16 groups, even when count is 0.
  const result: MainGroupItem[] = [];

  PERMANENT_MAIN_GROUPS.forEach((groupName) => {
    const grpData = groupsMap.get(groupName);
    if (!grpData || grpData.dictationIds.size === 0) {
      result.push({
        key: groupName,
        label: groupName,
        count: 0,
        subLevels: [],
      });
      return;
    }

    const totalCount = grpData.dictationIds.size;
    const subLevels: SubLevelItem[] = [];

    grpData.subLevelsMap.forEach((ids, subKey) => {
      if (ids.size > 0) {
        subLevels.push({
          key: subKey,
          label: subKey,
          count: ids.size,
        });
      }
    });

    // Sublevel ordering:
    if (groupName === 'Mầm non') {
      const order = ['Level 1 • Từ đơn', 'Level 2 • Cụm từ', 'Level 3 • Câu ngắn'];
      subLevels.sort((a, b) => {
        const idxA = order.indexOf(a.key);
        const idxB = order.indexOf(b.key);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.key.localeCompare(b.key);
      });
    } else if (groupName === 'Debate') {
      subLevels.sort((a, b) => {
        const numA = parseInt(a.key.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.key.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
        return a.key.localeCompare(b.key);
      });
    } else if (groupName === 'IELTS') {
      const order = ['Speaking', 'Listening', 'Reading', 'Writing'];
      subLevels.sort((a, b) => {
        const idxA = order.indexOf(a.key);
        const idxB = order.indexOf(b.key);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.key.localeCompare(b.key);
      });
    } else {
      subLevels.sort((a, b) => a.key.localeCompare(b.key, 'vi'));
    }

    result.push({
      key: groupName,
      label: groupName,
      count: totalCount,
      subLevels,
    });
  });

  return result;
}

/**
 * Evaluates whether a SavedDictationItem matches the active mainGroup and optional subLevel filter.
 */
export function itemMatchesFilter(
  item: SavedDictationItem,
  selectedMainGroup: string, // 'ALL' or group key
  selectedSubLevel: string, // 'ALL' or sublevel key
  teacherClasses: TeacherClass[] = []
): boolean {
  if (selectedMainGroup === 'ALL') {
    return true;
  }

  const { mainGroup, subLevel } = classifyExerciseItem(item, teacherClasses);
  if (mainGroup !== selectedMainGroup) {
    return false;
  }

  if (selectedSubLevel !== 'ALL') {
    return subLevel === selectedSubLevel;
  }

  return true;
}
