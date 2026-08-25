export type VoiceAccent = 'US' | 'UK';

export type PlaybackSpeed = 0.75 | 0.85 | 1.0 | 1.15;

export type CheckMode = 'EASY' | 'STRICT'; // 'EASY' (DỄ) | 'STRICT' (CHÍNH XÁC)

export type ListenLimit = 0 | 1 | 2 | 3; // 0 = Không giới hạn (unlimited)

export interface DictationSentence {
  id: string;
  order: number;
  text: string;
}

export interface DictationExercise {
  title: string;
  sentences: DictationSentence[];
  voiceAccent: VoiceAccent; // 'US' | 'UK'
  playbackSpeed: PlaybackSpeed; // 0.75 | 0.85 | 1.0 | 1.15
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
}

export interface PracticeSessionResult {
  studentName: string;
  exerciseTitle: string;
  score: number; // 0 - 100
  accuracy: number; // 0 - 100
  completedCount: number;
  totalSentences: number;
  wrongWords: string[];
  sentenceResults: SentenceSubmissionResult[];
  completedAt: string;
}
