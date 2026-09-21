import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Volume2,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Settings,
  X,
  Play,
  Square,
  Lightbulb,
  HelpCircle,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  Mic,
} from 'lucide-react';
import {
  DictationExercise,
  SentenceSubmissionResult,
  WordDiffItem,
} from '../types';
import {
  audioPlayer,
  subscribeToVoices,
  filterEnglishVoices,
  resolveVoice,
  PREVIEW_SENTENCE,
  getStoredVoiceAccent,
  setStoredVoiceAccent,
  getStoredPlaybackSpeed,
  setStoredPlaybackSpeed,
  getStoredVoiceURI,
  setStoredVoiceURI,
} from '../utils/audioPlayer';
import { compareSentenceAnswers } from '../utils/textComparison';
import {
  getFirstWord,
  getSentenceKeywords,
  generateSentenceFrame,
} from '../utils/hints';
import { splitSentenceIntoChunks, SentenceChunk } from '../utils/chunking';
import { getSentenceTranslation } from '../utils/translationHelper';

interface StudentPracticeViewProps {
  exercise: DictationExercise;
  studentName: string;
  onFinishAll: (results: SentenceSubmissionResult[]) => void;
  onExit: () => void;
}

export const StudentPracticeView: React.FC<StudentPracticeViewProps> = ({
  exercise,
  studentName,
  onFinishAll,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [replaysUsed, setReplaysUsed] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [audioErrorMessage, setAudioErrorMessage] = useState<string | null>(null);

  // Voice Accent & Speed with local persistence
  const [voiceAccent, setVoiceAccent] = useState<'US' | 'UK'>(() => getStoredVoiceAccent());
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => getStoredPlaybackSpeed());

  // Retry Before Reveal state
  const [attemptCount, setAttemptCount] = useState<number>(0); // 0 = first try, 1 = after 1st try wrong, 2 = final
  const [isFirstAttemptIncorrect, setIsFirstAttemptIncorrect] = useState<boolean>(false);

  // 3-Tier Hint Ladder state (0 = none, 1 = first word, 2 = keywords, 3 = sentence frame)
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [sentenceHintsUsed, setSentenceHintsUsed] = useState<number>(0);

  const [currentCheckResult, setCurrentCheckResult] = useState<{
    isCorrect: boolean;
    sentenceAccuracy: number;
    wordDiffs: WordDiffItem[];
    wrongWords: string[];
  } | null>(null);

  const [collectedResults, setCollectedResults] = useState<SentenceSubmissionResult[]>([]);

  // Student Voice Customization
  const [showAudioSettings, setShowAudioSettings] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [studentVoiceMode, setStudentVoiceMode] = useState<'DEFAULT' | 'CUSTOM'>(() => {
    return getStoredVoiceURI() ? 'CUSTOM' : 'DEFAULT';
  });
  const [studentSelectedVoiceURI, setStudentSelectedVoiceURI] = useState<string>(() => {
    return getStoredVoiceURI();
  });
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const isTestMode = exercise.exerciseMode === 'TEST';
  const currentSentence = exercise.sentences[currentIndex];
  const totalSentences = exercise.sentences.length;

  // Listening Mode: Full Sentence vs Natural Chunks
  const [listenMode, setListenMode] = useState<'FULL' | 'CHUNKS'>('FULL');
  const [playingChunkIndex, setPlayingChunkIndex] = useState<number | null>(null);

  // Translation display toggle (default: hidden)
  const [showTranslation, setShowTranslation] = useState<boolean>(false);

  // Natural chunks for current sentence
  const sentenceChunks = useMemo(() => {
    if (!currentSentence?.text) return [];
    return splitSentenceIntoChunks(currentSentence.text);
  }, [currentSentence?.text]);

  const sentenceWordCount = useMemo(() => {
    if (!currentSentence?.text) return 0;
    return currentSentence.text.trim().split(/\s+/).filter(Boolean).length;
  }, [currentSentence?.text]);

  // Vietnamese translation extraction for current sentence
  const translationInfo = useMemo(() => {
    return getSentenceTranslation(exercise.translation, currentIndex, totalSentences);
  }, [exercise.translation, currentIndex, totalSentences]);

  // Listen to browser voices on student device
  useEffect(() => {
    const unsubscribe = subscribeToVoices((voices) => {
      const en = filterEnglishVoices(voices);
      setAvailableVoices(en);
      const stored = getStoredVoiceURI();
      if (stored && en.some((v) => v.voiceURI === stored)) {
        setStudentSelectedVoiceURI(stored);
      } else if (en.length > 0 && !studentSelectedVoiceURI) {
        setStudentSelectedVoiceURI(en[0].voiceURI);
      }
    });
    return unsubscribe;
  }, [studentSelectedVoiceURI]);

  // Active student voice (if customized)
  const activeStudentVoice =
    studentVoiceMode === 'CUSTOM'
      ? availableVoices.find((v) => v.voiceURI === studentSelectedVoiceURI) || null
      : null;

  // Resolved active voice using priority:
  // 1. If studentVoiceMode === 'CUSTOM' and valid activeStudentVoice exists: use student's custom voice
  // 2. Otherwise use exercise voice configuration (voiceMode, preferredVoiceName, preferredVoiceURI, preferredLang, voiceAccent)
  // 3. If exercise voice cannot be resolved on student's device, gracefully fall back to existing accent-based voice resolution
  const resolvedEffectiveVoice = useMemo(() => {
    // Priority 1: Custom student voice
    if (studentVoiceMode === 'CUSTOM' && activeStudentVoice) {
      return activeStudentVoice;
    }

    // Priority 2 & 3: Exercise voice configuration with fallback to accent
    const fallbackAccent = voiceAccent || exercise.voiceAccent || 'US';
    return resolveVoice({
      voiceMode: exercise.voiceMode,
      preferredVoiceName: exercise.preferredVoiceName,
      preferredVoiceURI: exercise.preferredVoiceURI,
      preferredLang: exercise.preferredLang,
      accent: fallbackAccent,
    });
  }, [
    studentVoiceMode,
    activeStudentVoice,
    exercise.voiceMode,
    exercise.preferredVoiceName,
    exercise.preferredVoiceURI,
    exercise.preferredLang,
    exercise.voiceAccent,
    voiceAccent,
    availableVoices,
  ]);

  // Dedicated voice preference updater: ONLY updates voice accent & local storage
  // Completely isolated from exercise session state
  const handleSelectAccent = (accent: 'US' | 'UK') => {
    setVoiceAccent(accent);
    setStoredVoiceAccent(accent);
  };

  // Dedicated speed preference updater: ONLY updates playback speed & local storage
  const handleSelectSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setStoredPlaybackSpeed(speed);
  };

  // Reset state when moving to a new sentence (No automatic audio playback)
  useEffect(() => {
    setTypedAnswer('');
    setIsChecked(false);
    setAttemptCount(0);
    setIsFirstAttemptIncorrect(false);
    setHintLevel(0);
    setSentenceHintsUsed(0);
    setCurrentCheckResult(null);
    setReplaysUsed(0);
    setIsPlaying(false);
    setPlayingChunkIndex(null);
    setShowTranslation(false);
    setListenMode('FULL');
    setAudioErrorMessage(null);

    audioPlayer.stop();
  }, [currentIndex]);

  // Focus input when moving to a new sentence or when retrying
  useEffect(() => {
    if (!isChecked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, isChecked, isFirstAttemptIncorrect]);

  // UNLIMITED FULL-SENTENCE PLAYBACK
  const handlePlayAudio = () => {
    if (!currentSentence) {
      return;
    }

    setAudioErrorMessage(null);
    setIsPlaying(true);
    setReplaysUsed((prev) => prev + 1);

    audioPlayer.play({
      text: currentSentence.text,
      voice: resolvedEffectiveVoice || undefined,
      preferredVoiceURI: resolvedEffectiveVoice ? resolvedEffectiveVoice.voiceURI : undefined,
      accent: voiceAccent,
      speed: playbackSpeed,
      pitch: exercise.pitch ?? 1.0,
      onStart: () => {
        setIsPlaying(true);
        setAudioErrorMessage(null);
      },
      onEnd: () => setIsPlaying(false),
      onError: (err: any) => {
        setIsPlaying(false);
        setAudioErrorMessage(
          typeof err === 'string'
            ? err
            : err?.message ||
                'Thiết bị này chưa hỗ trợ giọng đọc. Vui lòng mở bằng Chrome hoặc Edge.'
        );
      },
    });
  };

  // UNLIMITED CHUNK PLAYBACK (Does not reset exercise or count toward limits)
  const handlePlayChunk = (chunk: SentenceChunk) => {
    audioPlayer.stop();
    setAudioErrorMessage(null);
    setPlayingChunkIndex(chunk.index);

    audioPlayer.play({
      text: chunk.text,
      voice: resolvedEffectiveVoice || undefined,
      preferredVoiceURI: resolvedEffectiveVoice ? resolvedEffectiveVoice.voiceURI : undefined,
      accent: voiceAccent,
      speed: playbackSpeed,
      pitch: exercise.pitch ?? 1.0,
      onStart: () => setPlayingChunkIndex(chunk.index),
      onEnd: () => setPlayingChunkIndex(null),
      onError: (err: any) => {
        setPlayingChunkIndex(null);
        setAudioErrorMessage(
          typeof err === 'string'
            ? err
            : err?.message || 'Thiết bị chưa thể phát âm thanh cho cụm này.'
        );
      },
    });
  };

  const handlePreviewCustomVoice = () => {
    if (isPlayingPreview) {
      audioPlayer.stop();
      setIsPlayingPreview(false);
      return;
    }

    setIsPlayingPreview(true);

    audioPlayer.play({
      text: PREVIEW_SENTENCE,
      voice: resolvedEffectiveVoice || undefined,
      preferredVoiceURI: resolvedEffectiveVoice ? resolvedEffectiveVoice.voiceURI : undefined,
      accent: voiceAccent,
      speed: playbackSpeed,
      pitch: exercise.pitch ?? 1.0,
      onStart: () => setIsPlayingPreview(true),
      onEnd: () => setIsPlayingPreview(false),
      onError: () => setIsPlayingPreview(false),
    });
  };

  // Hint button clicked
  const handleUnlockHint = () => {
    if (isTestMode || !currentSentence) return;
    if (hintLevel < 3) {
      const nextLevel = hintLevel + 1;
      setHintLevel(nextLevel);
      setSentenceHintsUsed((prev) => prev + 1);
    }
  };

  const handleCheckAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isChecked || !currentSentence) return;

    // Check sentence locally
    const diff = compareSentenceAnswers(
      currentSentence.text,
      typedAnswer,
      exercise.checkMode
    );

    // In TEST MODE: Do not show immediate correction or retry. Record & proceed.
    if (isTestMode) {
      const submissionItem: SentenceSubmissionResult = {
        sentenceOrder: currentIndex + 1,
        targetSentence: currentSentence.text,
        studentAnswer: typedAnswer.trim(),
        isCorrect: diff.isCorrect,
        sentenceAccuracy: diff.sentenceAccuracy,
        wordDiffs: diff.wordDiffs,
        replaysUsed,
        hintsUsed: 0,
        attemptsUsed: 1,
      };

      const updated = [...collectedResults, submissionItem];
      setCollectedResults(updated);

      if (currentIndex + 1 < totalSentences) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onFinishAll(updated);
      }
      return;
    }

    // In PRACTICE MODE:
    // Case 1: Answer is Correct on first or second try
    if (diff.isCorrect) {
      setCurrentCheckResult(diff);
      setIsChecked(true);
      setIsFirstAttemptIncorrect(false);

      const submissionItem: SentenceSubmissionResult = {
        sentenceOrder: currentIndex + 1,
        targetSentence: currentSentence.text,
        studentAnswer: typedAnswer.trim(),
        isCorrect: true,
        sentenceAccuracy: 100,
        wordDiffs: diff.wordDiffs,
        replaysUsed,
        hintsUsed: sentenceHintsUsed,
        attemptsUsed: attemptCount + 1,
      };

      setCollectedResults((prev) => [...prev, submissionItem]);
      return;
    }

    // Case 2: First attempt is Incorrect -> Prompt retry before reveal
    if (attemptCount === 0) {
      setAttemptCount(1);
      setIsFirstAttemptIncorrect(true);
      return;
    }

    // Case 3: Second attempt is Still Incorrect -> Reveal answer and word diffs
    setCurrentCheckResult(diff);
    setIsChecked(true);
    setIsFirstAttemptIncorrect(false);

    const submissionItem: SentenceSubmissionResult = {
      sentenceOrder: currentIndex + 1,
      targetSentence: currentSentence.text,
      studentAnswer: typedAnswer.trim(),
      isCorrect: false,
      sentenceAccuracy: diff.sentenceAccuracy,
      wordDiffs: diff.wordDiffs,
      replaysUsed,
      hintsUsed: sentenceHintsUsed,
      attemptsUsed: 2,
    };

    setCollectedResults((prev) => [...prev, submissionItem]);
  };

  const handleRetryTyping = () => {
    setIsFirstAttemptIncorrect(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < totalSentences) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onFinishAll(collectedResults);
    }
  };

  // Render Word-Level Visual Diff for Student's Answer
  const renderStudentDiffBadge = (diff: WordDiffItem, index: number) => {
    if (diff.type === 'correct') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-emerald-800 bg-emerald-100 border border-emerald-300"
        >
          ✓ {diff.studentWord || diff.correctWord}
        </span>
      );
    }

    if (diff.type === 'incorrect') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-rose-800 bg-rose-100 border border-rose-300 line-through decoration-2"
          title={diff.explanation}
        >
          ✕ {diff.studentWord}
        </span>
      );
    }

    if (diff.type === 'extra') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-amber-800 bg-amber-100 border border-amber-300"
          title="Từ thừa"
        >
          − {diff.studentWord}
        </span>
      );
    }

    if (diff.type === 'missing') {
      return (
        <span
          key={index}
          className="inline-block px-2.5 py-1 m-1 rounded-lg font-bold text-rose-700 bg-rose-50 border border-dashed border-rose-400"
          title={`Thiếu: ${diff.correctWord}`}
        >
          [thiếu: {diff.correctWord}]
        </span>
      );
    }

    return null;
  };

  const progressPercent = Math.round(((currentIndex + 1) / totalSentences) * 100);

  // Resolved default voice on this machine for display
  const defaultResolvedVoice = resolveVoice({
    voiceMode: exercise.voiceMode,
    preferredVoiceName: exercise.preferredVoiceName,
    preferredVoiceURI: exercise.preferredVoiceURI,
    preferredLang: exercise.preferredLang,
    accent: voiceAccent,
  });

  return (
    <div id="student-practice-view" className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Header & Progress */}
      <header className="w-full max-w-2xl mx-auto space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-extrabold text-slate-900 text-base sm:text-lg truncate max-w-[170px] sm:max-w-md">
                {exercise.title}
              </h2>
              {isTestMode && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md shrink-0">
                  ⏱️ Kiểm tra
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Học sinh: <span className="font-bold text-slate-700">{studentName}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Audio Settings Button */}
            <button
              id="btn-student-audio-settings"
              onClick={() => setShowAudioSettings(true)}
              className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600 hover:text-indigo-700 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
              title="Tùy chỉnh giọng đọc nếu muốn"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">⚙️ ÂM THANH</span>
              <span className="sm:hidden">⚙️</span>
            </button>

            <span className="text-xs sm:text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
              Câu {currentIndex + 1} / {totalSentences}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Center Interactive Practice Area */}
      <main className="w-full max-w-2xl mx-auto my-auto py-4 space-y-4">
        {/* Audio Listen Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200 text-center space-y-4">
          {/* Top Controls Bar: Voice selection (US/UK) & Speed selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            {/* Voice selection: US / UK */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-voice-us"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectAccent('US');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center space-x-1.5 ${
                  voiceAccent === 'US'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Giọng chuẩn English US"
              >
                <span>🇺🇸</span>
                <span>US</span>
              </button>
              <button
                type="button"
                id="btn-voice-uk"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectAccent('UK');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center space-x-1.5 ${
                  voiceAccent === 'UK'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Giọng chuẩn English UK"
              >
                <span>🇬🇧</span>
                <span>UK</span>
              </button>
            </div>

            {/* Playback speed selector: 0.75x, 0.9x, 1.0x */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-400 mr-0.5">Tốc độ:</span>
              {([0.75, 0.9, 1.0] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  id={`btn-speed-${spd}`}
                  onClick={() => handleSelectSpeed(spd)}
                  className={`px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                    playbackSpeed === spd
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-black shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>
          </div>

          {/* TWO LISTENING MODES SELECTOR:
              1. 🔊 NGHE CẢ CÂU
              2. 🧩 NGHE TỪNG CỤM
          */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              id="btn-mode-full-sentence"
              onClick={() => setListenMode('FULL')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all border flex items-center space-x-1.5 cursor-pointer ${
                listenMode === 'FULL'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-100'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>🔊 NGHE CẢ CÂU</span>
            </button>

            <button
              type="button"
              id="btn-mode-chunk-listening"
              onClick={() => setListenMode('CHUNKS')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all border flex items-center space-x-1.5 cursor-pointer relative ${
                listenMode === 'CHUNKS'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-100'
                  : sentenceWordCount > 14
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 font-black'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>🧩 NGHE TỪNG CỤM</span>
              {sentenceChunks.length > 1 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    listenMode === 'CHUNKS'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {sentenceChunks.length} cụm
                </span>
              )}
            </button>
          </div>

          {/* Prominent hint for sentences with > 14 words */}
          {sentenceWordCount > 14 && listenMode === 'FULL' && (
            <div className="p-2 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-center space-x-1.5">
              <span>💡 Câu này khá dài. Em có thể chuyển sang</span>
              <button
                type="button"
                onClick={() => setListenMode('CHUNKS')}
                className="font-bold underline text-amber-950 cursor-pointer hover:text-indigo-600"
              >
                🧩 NGHE TỪNG CỤM
              </button>
              <span>để nghe dễ hơn!</span>
            </div>
          )}

          {/* MODE 1: FULL SENTENCE LISTENING */}
          {listenMode === 'FULL' ? (
            <div className="py-2 space-y-3">
              {/* Big Audio Button */}
              <button
                id="btn-play-audio"
                onClick={handlePlayAudio}
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full mx-auto flex flex-col items-center justify-center space-y-1 transition-all shadow-md active:scale-95 cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-500 text-white ring-8 ring-amber-100 animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-8 ring-indigo-50 hover:ring-indigo-100'
                }`}
              >
                <Volume2 className={`w-10 h-10 sm:w-12 sm:h-12 ${isPlaying ? 'animate-bounce' : ''}`} />
                <span className="font-extrabold text-sm sm:text-base uppercase tracking-wider">
                  {isPlaying ? 'Đang đọc' : 'NGHE'}
                </span>
              </button>
            </div>
          ) : (
            /* MODE 2: CHUNK LISTENING (AUDIO ONLY - NEVER REVEALS TEXT) */
            <div id="chunk-listening-container" className="space-y-3 py-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Các cụm tự nhiên ({sentenceChunks.length} cụm):</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  ♾️ Nghe lại từng cụm thoải mái
                </span>
              </div>

              <div className="space-y-2.5">
                {sentenceChunks.map((chunk) => (
                  <div
                    key={chunk.index}
                    id={`chunk-item-${chunk.index + 1}`}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      playingChunkIndex === chunk.index
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100'
                        : 'bg-slate-50 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-extrabold uppercase px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-200/70">
                        CỤM {chunk.index + 1}/{chunk.total}
                      </span>
                      {playingChunkIndex === chunk.index && (
                        <span className="text-xs font-bold text-amber-600 animate-pulse flex items-center space-x-1">
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Đang đọc...</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      id={`btn-play-chunk-${chunk.index + 1}`}
                      onClick={() => handlePlayChunk(chunk)}
                      className={`min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 shadow-xs active:scale-95 ${
                        playingChunkIndex === chunk.index
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <Volume2 className="w-4 h-4 shrink-0" />
                      <span>{playingChunkIndex === chunk.index ? 'Đang đọc...' : '🔊 NGHE CỤM'}</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Full sentence listen fallback button */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  id="btn-chunk-mode-play-full"
                  onClick={handlePlayAudio}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center space-x-1.5 border border-slate-200 cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-4 h-4 text-indigo-600" />
                  <span>🔊 Nghe toàn bộ câu</span>
                </button>
              </div>
            </div>
          )}

          {/* VIETNAMESE TRANSLATION TOGGLE (PART 3) */}
          {translationInfo.hasTranslation && (
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex justify-center">
                <button
                  type="button"
                  id="btn-toggle-translation"
                  onClick={() => setShowTranslation((prev) => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all border flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-2xs ${
                    showTranslation
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-100'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {showTranslation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showTranslation ? '👁 ẨN BẢN DỊCH' : '🇻🇳 XEM BẢN DỊCH'}</span>
                </button>
              </div>

              {showTranslation && (
                <div
                  id="translation-display-card"
                  className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 text-left animate-in fade-in zoom-in-95 space-y-1"
                >
                  <div className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider text-emerald-800">
                    <span>🇻🇳 Bản dịch tiếng Việt:</span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-emerald-950 leading-relaxed select-text">
                    {translationInfo.sentenceTranslation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Friendly Audio Error Alert */}
          {audioErrorMessage && (
            <div
              id="audio-error-banner"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 text-left animate-in fade-in"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{audioErrorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAudioSettings(true)}
                className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
              >
                ⚙️ Đổi giọng
              </button>
            </div>
          )}
        </div>

        {/* Input & Check Card (When answer is not submitted/revealed yet) */}
        {!isChecked ? (
          <form
            onSubmit={handleCheckAnswer}
            className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4"
          >
            {/* RETRY PROMPT BANNER (First attempt incorrect in Practice Mode) */}
            {isFirstAttemptIncorrect && (
              <div
                id="retry-hint-banner"
                className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2 animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-xl">💪</span>
                  <p className="font-extrabold text-sm sm:text-base text-amber-900">
                    Gần đúng rồi! Nghe lại và thử thêm một lần nhé.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-retry-listen"
                    onClick={handlePlayAudio}
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>🔊 NGHE LẠI</span>
                  </button>

                  <button
                    type="button"
                    id="btn-retry-type"
                    onClick={handleRetryTyping}
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                    <span>THỬ LẠI</span>
                  </button>
                </div>
              </div>
            )}

            {/* Input Header with Optional Small Hint Button */}
            <div className="flex items-center justify-between">
              <label
                htmlFor="input-dictation-answer"
                className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider"
              >
                Gõ câu em nghe được:
              </label>

              {/* 💡 GỢI Ý button (Only in Practice Mode) */}
              {!isTestMode && (
                <button
                  type="button"
                  id="btn-hint-ladder"
                  onClick={handleUnlockHint}
                  disabled={hintLevel >= 3}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    hintLevel === 0
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                      : hintLevel === 1 || hintLevel === 2
                      ? 'bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
                  }`}
                  title={
                    hintLevel === 0
                      ? 'Mở gợi ý 1: Từ đầu tiên'
                      : hintLevel === 1
                      ? 'Mở gợi ý 2: Từ khóa'
                      : hintLevel === 2
                      ? 'Mở gợi ý 3: Khung câu'
                      : 'Đã mở hết gợi ý'
                  }
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                  <span>
                    {hintLevel === 0
                      ? '💡 GỢI Ý 1'
                      : hintLevel === 1
                      ? '💡 GỢI Ý 2'
                      : hintLevel === 2
                      ? '💡 GỢI Ý 3'
                      : '💡 ĐÃ MỞ GỢI Ý'}
                  </span>
                </button>
              )}
            </div>

            {/* PROGRESSIVE HINT DISPLAY BOX (3 Levels) */}
            {hintLevel > 0 && currentSentence && (
              <div
                id="hint-ladder-box"
                className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm space-y-2.5 text-left animate-in fade-in"
              >
                {/* GỢI Ý 1: Từ đầu tiên */}
                {hintLevel >= 1 && (
                  <div id="hint-level-1" className="font-bold text-amber-900 flex items-center space-x-2">
                    <span className="text-base">💡</span>
                    <span>
                      Từ đầu tiên là:{' '}
                      <strong className="text-indigo-900 font-black px-2 py-0.5 bg-white rounded-md border border-amber-300 shadow-2xs select-text">
                        {getFirstWord(currentSentence.text)}
                      </strong>
                    </span>
                  </div>
                )}

                {/* GỢI Ý 2: Từ khóa */}
                {hintLevel >= 2 && (
                  <div id="hint-level-2" className="font-bold text-amber-900 flex items-start space-x-2 pt-2 border-t border-amber-200/60">
                    <span className="text-base shrink-0">💡</span>
                    <div className="flex-1">
                      <span>Từ khóa:{' '}</span>
                      <strong className="text-indigo-900 font-black px-2 py-0.5 bg-white rounded-md border border-amber-300 shadow-2xs select-text">
                        {getSentenceKeywords(currentSentence.text).join(' – ')}
                      </strong>
                    </div>
                  </div>
                )}

                {/* GỢI Ý 3: Khung câu */}
                {hintLevel >= 3 && (
                  <div id="hint-level-3" className="font-bold text-amber-900 space-y-1.5 pt-2 border-t border-amber-200/60">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">💡</span>
                      <span>Khung câu:</span>
                    </div>
                    <div className="bg-white/95 p-2.5 rounded-xl border border-amber-300 font-mono text-xs sm:text-sm font-bold text-indigo-950 tracking-wide select-text">
                      "{generateSentenceFrame(currentSentence.text)}"
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Answer Input */}
            <div>
              <input
                id="input-dictation-answer"
                ref={inputRef}
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder={isFirstAttemptIncorrect ? 'Sửa hoặc gõ lại câu em nghe...' : 'Gõ câu em nghe được...'}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={`w-full px-4 py-4 text-lg sm:text-xl rounded-2xl border-2 font-semibold text-slate-900 leading-relaxed placeholder:text-slate-400 placeholder:font-normal focus:outline-none transition-all ${
                  isFirstAttemptIncorrect
                    ? 'border-amber-400 bg-amber-50/20 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                    : 'border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                id="btn-replay-audio"
                onClick={handlePlayAudio}
                className="min-h-[48px] py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                <span>NGHE LẠI</span>
              </button>

              <button
                type="submit"
                id="btn-check-answer"
                className="min-h-[48px] py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isTestMode ? (currentIndex + 1 < totalSentences ? 'GỬI & TIẾP THEO' : 'HOÀN THÀNH') : 'KIỂM TRA'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Feedback Card (Shown in Practice Mode after answer is final) */
          <div
            id="feedback-card"
            className="bg-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-5 animate-in fade-in zoom-in-95"
          >
            {/* Feedback Banner */}
            {currentCheckResult?.isCorrect ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-900">
                <span className="text-2xl">⭐</span>
                <div>
                  <h4 className="font-extrabold text-base sm:text-lg text-emerald-800">
                    Tuyệt vời! Chính xác!
                  </h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    Em đã nghe và gõ đúng câu này.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center space-x-3 text-amber-900">
                <span className="text-2xl">💪</span>
                <div>
                  <h4 className="font-extrabold text-base sm:text-lg text-amber-800">
                    Em xem lại các từ khác biệt bên dưới để nhớ nhé.
                  </h4>
                  <p className="text-xs text-amber-700 font-medium">
                    Độ chính xác câu này: {currentCheckResult?.sentenceAccuracy}%
                  </p>
                </div>
              </div>
            )}

            {/* CÂU CỦA EM */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                CÂU CỦA EM:
              </label>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm sm:text-base leading-relaxed flex flex-wrap items-center">
                {currentCheckResult?.wordDiffs && currentCheckResult.wordDiffs.length > 0 ? (
                  currentCheckResult.wordDiffs.map((diff, i) => renderStudentDiffBadge(diff, i))
                ) : (
                  <span className="text-slate-400 italic font-normal">Chưa nhập câu trả lời</span>
                )}
              </div>
            </div>

            {/* CÂU ĐÚNG */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
                CÂU ĐÚNG:
              </label>
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-base sm:text-lg font-bold text-indigo-950 leading-relaxed flex items-center justify-between gap-2">
                <span>{currentSentence?.text}</span>
                <button
                  type="button"
                  title="Nghe lại câu đúng"
                  onClick={() => {
                    audioPlayer.play({
                      text: currentSentence?.text || '',
                      voice: resolvedEffectiveVoice || undefined,
                      preferredVoiceURI: resolvedEffectiveVoice ? resolvedEffectiveVoice.voiceURI : undefined,
                      accent: voiceAccent,
                      speed: playbackSpeed,
                      pitch: exercise.pitch ?? 1.0,
                    });
                  }}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Translation in feedback card if available */}
              {translationInfo.hasTranslation && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center space-x-2">
                  <span className="shrink-0 font-black">🇻🇳 Dịch:</span>
                  <span className="select-text">{translationInfo.sentenceTranslation}</span>
                </div>
              )}
            </div>

            {/* Next Button */}
            <button
              id="btn-next-sentence"
              onClick={handleNext}
              className="w-full min-h-[52px] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
            >
              <span>{currentIndex + 1 < totalSentences ? 'TIẾP THEO' : 'XEM KẾT QUẢ'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-slate-400 pt-2">
        <button
          id="btn-quit-practice"
          onClick={onExit}
          className="text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
        >
          Dừng bài tập
        </button>
        <span>
          {isTestMode ? 'Chế độ: KIỂM TRA' : 'Chế độ: LUYỆN TẬP'} • {exercise.checkMode === 'EASY' ? 'DỄ' : 'CHÍNH XÁC'}
        </span>
      </footer>

      {/* Student Optional Audio Settings Modal */}
      {showAudioSettings && (
        <div id="modal-audio-settings" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>⚙️ Cài đặt âm thanh</span>
              </h3>
              <button
                onClick={() => setShowAudioSettings(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Nếu thiết bị của em có giọng đọc tiếng Anh hay hơn, em có thể chuyển đổi tại đây.
              </p>

              {/* Option 1: Default from exercise */}
              <label
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  studentVoiceMode === 'DEFAULT'
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="student-voice-choice"
                  checked={studentVoiceMode === 'DEFAULT'}
                  onChange={() => setStudentVoiceMode('DEFAULT')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-slate-900">Giọng mặc định của bài</p>
                  <p className="text-slate-500">
                    {defaultResolvedVoice ? `${defaultResolvedVoice.name} (${defaultResolvedVoice.lang})` : 'Tự động chọn giọng chuẩn nhất'}
                  </p>
                </div>
              </label>

              {/* Option 2: Custom voice on student machine */}
              <label
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  studentVoiceMode === 'CUSTOM'
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="student-voice-choice"
                  checked={studentVoiceMode === 'CUSTOM'}
                  onChange={() => setStudentVoiceMode('CUSTOM')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs space-y-2 flex-1">
                  <p className="font-bold text-slate-900">Giọng khác trên thiết bị</p>
                  {availableVoices.length > 0 ? (
                    <select
                      id="select-student-voice"
                      value={studentSelectedVoiceURI}
                      disabled={studentVoiceMode !== 'CUSTOM'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentSelectedVoiceURI(val);
                        setStudentVoiceMode('CUSTOM');
                        setStoredVoiceURI(val);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Đang tải giọng từ máy...</p>
                  )}
                </div>
              </label>
            </div>

            {/* Test Sample Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                id="btn-preview-student-voice"
                onClick={handlePreviewCustomVoice}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
              >
                {isPlayingPreview ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current text-amber-600" />
                    <span>Dừng thử giọng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-indigo-600" />
                    <span>▶ Nghe thử giọng này</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowAudioSettings(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
