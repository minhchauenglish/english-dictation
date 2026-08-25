import React, { useState, useEffect, useRef } from 'react';
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
} from '../utils/audioPlayer';
import { compareSentenceAnswers } from '../utils/textComparison';
import {
  getSentenceWordCount,
  generateFirstLetterHint,
} from '../utils/hints';

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

  // Retry Before Reveal state
  const [attemptCount, setAttemptCount] = useState<number>(0); // 0 = first try, 1 = after 1st try wrong, 2 = final
  const [isFirstAttemptIncorrect, setIsFirstAttemptIncorrect] = useState<boolean>(false);

  // Hint Ladder state (0 = none, 1 = word count, 2 = first-letter pattern)
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
  const [studentVoiceMode, setStudentVoiceMode] = useState<'DEFAULT' | 'CUSTOM'>('DEFAULT');
  const [studentSelectedVoiceURI, setStudentSelectedVoiceURI] = useState<string>('');
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const isTestMode = exercise.exerciseMode === 'TEST';
  const currentSentence = exercise.sentences[currentIndex];
  const totalSentences = exercise.sentences.length;
  const listenLimit = exercise.listenLimit ?? 3; // 0 = unlimited, 1, 2, 3
  const isLimitReached = listenLimit > 0 && replaysUsed >= listenLimit;

  // Listen to browser voices on student device
  useEffect(() => {
    const unsubscribe = subscribeToVoices((voices) => {
      const en = filterEnglishVoices(voices);
      setAvailableVoices(en);
      if (en.length > 0 && !studentSelectedVoiceURI) {
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
    setAudioErrorMessage(null);

    audioPlayer.stop();
  }, [currentIndex]);

  // Focus input when moving to a new sentence or when retrying
  useEffect(() => {
    if (!isChecked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, isChecked, isFirstAttemptIncorrect]);

  const handlePlayAudio = () => {
    if (!currentSentence || (listenLimit > 0 && replaysUsed >= listenLimit)) {
      return;
    }

    setAudioErrorMessage(null);
    setIsPlaying(true);
    setReplaysUsed((prev) => prev + 1);

    audioPlayer.play({
      text: currentSentence.text,
      voice: activeStudentVoice || undefined,
      voiceMode: activeStudentVoice ? undefined : exercise.voiceMode,
      preferredVoiceName: activeStudentVoice ? undefined : exercise.preferredVoiceName,
      preferredVoiceURI: activeStudentVoice ? undefined : exercise.preferredVoiceURI,
      preferredLang: activeStudentVoice ? undefined : exercise.preferredLang,
      accent: exercise.voiceAccent,
      speed: exercise.playbackSpeed || 0.95,
      pitch: exercise.pitch ?? 1.0,
      onStart: () => {
        setIsPlaying(true);
        setAudioErrorMessage(null);
      },
      onEnd: () => setIsPlaying(false),
      onError: (err: any) => {
        setIsPlaying(false);
        // Do not count failed technical playback attempt as an additional listening attempt
        setReplaysUsed((prev) => Math.max(0, prev - 1));
        setAudioErrorMessage(
          typeof err === 'string'
            ? err
            : err?.message ||
                'Không thể phát giọng đọc trên thiết bị này. Hãy thử chọn một giọng khác trong ÂM THANH.'
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
      voice: activeStudentVoice || undefined,
      voiceMode: activeStudentVoice ? undefined : exercise.voiceMode,
      preferredVoiceName: activeStudentVoice ? undefined : exercise.preferredVoiceName,
      preferredVoiceURI: activeStudentVoice ? undefined : exercise.preferredVoiceURI,
      preferredLang: activeStudentVoice ? undefined : exercise.preferredLang,
      accent: exercise.voiceAccent,
      speed: exercise.playbackSpeed || 0.95,
      pitch: exercise.pitch ?? 1.0,
      onStart: () => setIsPlayingPreview(true),
      onEnd: () => setIsPlayingPreview(false),
      onError: () => setIsPlayingPreview(false),
    });
  };

  // Hint button clicked
  const handleUnlockHint = () => {
    if (isTestMode || !currentSentence) return;
    if (hintLevel < 2) {
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
    accent: exercise.voiceAccent,
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
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200 text-center space-y-3.5">
          {/* Big Audio Button */}
          <button
            id="btn-play-audio"
            onClick={handlePlayAudio}
            disabled={isLimitReached && !isPlaying}
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full mx-auto flex flex-col items-center justify-center space-y-1 transition-all shadow-md active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-white ring-8 ring-amber-100 animate-pulse'
                : isLimitReached
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-8 ring-indigo-50 hover:ring-indigo-100'
            }`}
          >
            <Volume2 className={`w-10 h-10 sm:w-12 sm:h-12 ${isPlaying ? 'animate-bounce' : ''}`} />
            <span className="font-extrabold text-sm sm:text-base uppercase tracking-wider">
              {isPlaying ? 'Đang đọc' : 'NGHE'}
            </span>
          </button>

          {/* Listen Limit Counter */}
          <p id="listen-limit-counter" className="text-xs sm:text-sm font-semibold text-slate-500">
            {listenLimit === 0 ? (
              <span className="text-emerald-600">Lượt nghe: {replaysUsed} (Không giới hạn)</span>
            ) : (
              <span>
                Lượt nghe: <span className="font-bold text-slate-800">{replaysUsed}</span> / {listenLimit}
                {isLimitReached && <span className="text-rose-600 font-bold ml-1.5">(Đã hết lượt nghe)</span>}
              </span>
            )}
          </p>

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
                    disabled={isLimitReached}
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
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
                  disabled={hintLevel >= 2}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    hintLevel === 0
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                      : hintLevel === 1
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
                  }`}
                  title={
                    hintLevel === 0
                      ? 'Mở gợi ý số từ'
                      : hintLevel === 1
                      ? 'Mở gợi ý chữ cái đầu'
                      : 'Đã mở hết gợi ý'
                  }
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                  <span>
                    {hintLevel === 0
                      ? '💡 GỢI Ý'
                      : hintLevel === 1
                      ? '💡 GỢI Ý 2'
                      : '💡 ĐÃ MỞ GỢI Ý'}
                  </span>
                </button>
              )}
            </div>

            {/* PROGRESSIVE HINT DISPLAY BOX */}
            {hintLevel > 0 && currentSentence && (
              <div
                id="hint-ladder-box"
                className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm space-y-1.5 text-left animate-in fade-in"
              >
                {hintLevel >= 1 && (
                  <div className="font-bold text-amber-900 flex items-center space-x-1.5">
                    <span className="text-base">📝</span>
                    <span>Câu này có <strong>{getSentenceWordCount(currentSentence.text)}</strong> từ.</span>
                  </div>
                )}

                {hintLevel >= 2 && (
                  <div className="pt-1 border-t border-amber-200/60 font-mono text-xs sm:text-sm font-black text-indigo-950 tracking-wider bg-white/80 p-2.5 rounded-xl border border-amber-300">
                    <span className="text-[11px] font-sans font-bold text-slate-500 block mb-1">
                      Chữ cái đầu mỗi từ:
                    </span>
                    <span className="text-indigo-700 select-none">
                      {generateFirstLetterHint(currentSentence.text)}
                    </span>
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
                disabled={isLimitReached}
                className="min-h-[48px] py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold text-base transition-all flex items-center justify-center space-x-2 cursor-pointer"
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
                      voice: activeStudentVoice || undefined,
                      voiceMode: activeStudentVoice ? undefined : exercise.voiceMode,
                      preferredVoiceName: activeStudentVoice ? undefined : exercise.preferredVoiceName,
                      preferredVoiceURI: activeStudentVoice ? undefined : exercise.preferredVoiceURI,
                      preferredLang: activeStudentVoice ? undefined : exercise.preferredLang,
                      accent: exercise.voiceAccent,
                      speed: exercise.playbackSpeed || 0.9,
                      pitch: exercise.pitch ?? 1.0,
                    });
                  }}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
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
                        setStudentSelectedVoiceURI(e.target.value);
                        setStudentVoiceMode('CUSTOM');
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
