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
  // Duplicate detection state
  isDuplicate?: boolean;
  duplicateExistingId?: string;
  duplicateExistingTitle?: string;
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
  lessons: ImportedLesson[];
  errors: string[];
  rawText?: string;
}

export interface ImportBatchSummary {
  totalFiles: number;
  totalLessonsDetected: number;
  totalLessonsSelected: number;
  classesAssigned: string[];
}
