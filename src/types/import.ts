export type LessonContentType =
  | 'WORDS'
  | 'SENTENCES'
  | 'PARAGRAPH'
  | 'WORDS_AND_SENTENCES'
  | 'MIXED';

export type DuplicateResolution = 'IMPORT_ANYWAY' | 'SKIP' | 'REPLACE';

export interface ImportedLesson {
  id: string;
  lessonNumber: string;
  title: string;
  type: LessonContentType;
  words: string[];
  sentences: string[];
  paragraph?: string;
  translation?: string; // Optional Vietnamese translation
  selected: boolean;
  fileId: string;
  fileName: string;
  detectedClass?: string;
  detectedGrade?: string;
  detectedGroup?: string;
  detectedLevel?: string;
  lessonCode?: string;
  unitNumber?: string;
  unitTitle?: string;
  detectedUnit?: string;
  detectedUnitTitle?: string;
  // Duplicate detection state
  isDuplicate?: boolean;
  duplicateExistingId?: string;
  duplicateExistingTitle?: string;
  duplicateExistingGroup?: string;
  duplicateExistingUnit?: string;
  duplicateExistingLesson?: string;
  duplicateResolution?: DuplicateResolution;
  // Validation errors for this specific lesson
  validationError?: string;
}

export interface ImportFileResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  detectedClass?: string;
  detectedGrade?: string;
  detectedGroup?: string;
  detectedLevel?: string;
  unitNumber?: string;
  unitTitle?: string;
  detectedUnit?: string;
  detectedUnitTitle?: string;
  lessons: ImportedLesson[];
  errors: string[];
  rawText?: string;
  // Debate stats:
  isDebate?: boolean;
  debateLevelStats?: {
    level2: { detected: number; expected: number; status: 'PASS' | 'FAIL' };
    level3: { detected: number; expected: number; status: 'PASS' | 'FAIL' };
    level4: { detected: number; expected: number; status: 'PASS' | 'FAIL' };
    totalDetected: number;
    totalExpected: number;
  };
  // Audit / Post-parse diagnostics:
  totalUnitsDetected?: number;
  detectedUnitsList?: string[];
  firstLessonNumber?: string;
  lastLessonNumber?: string;
  missingLessonNumbers?: number[];
  duplicateLessonNumbers?: string[];
  auditWarning?: string;
}

export interface ImportBatchSummary {
  totalFiles: number;
  totalLessonsDetected: number;
  totalLessonsSelected: number;
  classesAssigned: string[];
}
