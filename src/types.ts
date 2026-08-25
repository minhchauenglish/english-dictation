export type VoiceAccent = 'US' | 'UK';

export type VoiceMode = 'NATURAL' | 'US' | 'UK' | 'CUSTOM';

export type VoicePitch = 0.9 | 1.0 | 1.05 | 1.1;

export type PlaybackSpeed = 0.75 | 0.85 | 0.9 | 0.95 | 1.0 | 1.15;

export type CheckMode = 'EASY' | 'STRICT'; // 'EASY' (DỄ) | 'STRICT' (CHÍNH XÁC)

export type ListenLimit = 0 | 1 | 2 | 3; // 0 = Không giới hạn (unlimited)

export type ExerciseMode = 'PRACTICE' | 'TEST'; // 'PRACTICE' (LUYỆN TẬP) | 'TEST' (KIỂM TRA)

export interface DictationSentence {
  id: string;
  order: number;
  text: string;
}

export interface DictationExercise {
  title: string;
  sentences: DictationSentence[];
  exerciseMode?: ExerciseMode; // 'PRACTICE' (default) | 'TEST'
  voiceMode?: VoiceMode; // 'NATURAL' | 'US' | 'UK' | 'CUSTOM'
  voiceAccent: VoiceAccent; // 'US' | 'UK' (fallback accent)
  preferredVoiceName?: string; // e.g. "Microsoft Aria Online (Natural) - English (United States)"
  preferredVoiceURI?: string;
  preferredLang?: string; // e.g. "en-US", "en-GB"
  pitch?: VoicePitch; // 0.9 | 1.0 | 1.05 | 1.1 (default 1.0)
  playbackSpeed: PlaybackSpeed; // 0.75 | 0.85 | 0.9 | 0.95 | 1.0 | 1.15 (default 0.9)
  listenLimit: ListenLimit; // 0 (unlimited), 1, 2, 3
  checkMode: CheckMode; // 'EASY' | 'STRICT'
  createdAt?: string;
}

export interface WordDiffItem {
  type: 'correct' | 'incorrect' | 'missing' | 'extra';
  studentWord?: string;
  correctWord?: string;
  explanation?: string;
}

export interface SentenceSubmissionResult {
  sentenceOrder: number;
  targetSentence: string;
  studentAnswer: string;
  isCorrect: boolean;
  sentenceAccuracy: number; // 0 - 100
  wordDiffs: WordDiffItem[];
  replaysUsed: number;
  hintsUsed?: number;
  attemptsUsed?: number;
}

export interface PracticeSessionResult {
  studentName: string;
  exerciseTitle: string;
  score: number; // 0 - 100
  accuracy: number; // 0 - 100
  completedCount: number;
  totalSentences: number;
  wrongWords: string[];
  hintsUsedTotal?: number;
  sentenceResults: SentenceSubmissionResult[];
  completedAt: string;
  isRemediationRound?: boolean;
}
