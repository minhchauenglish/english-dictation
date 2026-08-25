import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Scissors,
  Plus,
  Trash2,
  Volume2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Link as LinkIcon,
  AlertCircle,
  Play,
  Square,
  Settings2,
} from 'lucide-react';
import {
  DictationExercise,
  DictationSentence,
  ExerciseMode,
  VoiceAccent,
  VoiceMode,
  VoicePitch,
  PlaybackSpeed,
  CheckMode,
  ListenLimit,
} from '../types';
import { splitPassageIntoSentences } from '../utils/textComparison';
import {
  audioPlayer,
  subscribeToVoices,
  filterEnglishVoices,
  resolveVoice,
  PREVIEW_SENTENCE,
} from '../utils/audioPlayer';
import { clientStorage } from '../utils/storage';

interface TeacherCreateViewProps {
  onBackToHome: () => void;
  onGenerateShareLink: (exercise: DictationExercise) => void;
}

const SPEED_OPTIONS: { value: PlaybackSpeed; label: string; desc: string }[] = [
  { value: 0.75, label: '0.75x', desc: 'Rất chậm' },
  { value: 0.85, label: '0.85x', desc: 'Chậm' },
  { value: 0.9, label: '0.9x', desc: 'Vừa chậm' },
  { value: 0.95, label: '0.95x', desc: 'Tự nhiên' },
  { value: 1.0, label: '1.0x', desc: 'Bình thường' },
  { value: 1.15, label: '1.15x', desc: 'Nhanh' },
];

const PITCH_OPTIONS: { value: VoicePitch; label: string; desc: string }[] = [
  { value: 0.9, label: '0.9', desc: 'Trầm' },
  { value: 1.0, label: '1.0', desc: 'Chuẩn' },
  { value: 1.05, label: '1.05', desc: 'Sáng' },
  { value: 1.1, label: '1.1', desc: 'Cao' },
];

export const TeacherCreateView: React.FC<TeacherCreateViewProps> = ({
  onBackToHome,
  onGenerateShareLink,
}) => {
  const [title, setTitle] = useState('');
  const [rawPassage, setRawPassage] = useState('');
  const [sentences, setSentences] = useState<DictationSentence[]>([]);
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>('PRACTICE');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('NATURAL');
  const [preferredVoiceName, setPreferredVoiceName] = useState<string>('');
  const [preferredVoiceURI, setPreferredVoiceURI] = useState<string>('');
  const [preferredLang, setPreferredLang] = useState<string>('');
  const [pitch, setPitch] = useState<VoicePitch>(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(0.95);
  const [listenLimit, setListenLimit] = useState<ListenLimit>(3);
  const [checkMode, setCheckMode] = useState<CheckMode>('EASY');

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlayingVoiceSample, setIsPlayingVoiceSample] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Subscribe to voices list
  useEffect(() => {
    const unsubscribe = subscribeToVoices((voices) => {
      const en = filterEnglishVoices(voices);
      setAvailableVoices(en);
    });
    return unsubscribe;
  }, []);

  // Load draft on mount
  useEffect(() => {
    const draft = clientStorage.getTeacherDraft();
    if (draft) {
      setTitle(draft.title || '');
      setRawPassage(draft.passage || '');
      if (draft.exerciseMode) setExerciseMode(draft.exerciseMode);
      if (draft.voiceMode) setVoiceMode(draft.voiceMode);
      if (draft.preferredVoiceName) setPreferredVoiceName(draft.preferredVoiceName);
      if (draft.preferredVoiceURI) setPreferredVoiceURI(draft.preferredVoiceURI);
      if (draft.preferredLang) setPreferredLang(draft.preferredLang);
      if (draft.pitch !== undefined) setPitch(draft.pitch as VoicePitch);
      if (draft.playbackSpeed) setPlaybackSpeed(draft.playbackSpeed as PlaybackSpeed);
      if (draft.listenLimit !== undefined) setListenLimit(draft.listenLimit as ListenLimit);
      if (draft.checkMode) setCheckMode(draft.checkMode);

      if (draft.passage) {
        const split = splitPassageIntoSentences(draft.passage);
        setSentences(
          split.map((text, idx) => ({
            id: `s_${Date.now()}_${idx}`,
            order: idx + 1,
            text,
          }))
        );
      }
    } else {
      // Default sample in input to help teacher test immediately
      const defaultExample =
        "I get up at six o'clock every morning.\nI have breakfast with my family.\nI go to school by bus.\nI like English very much.\nI do my homework in the evening.";
      setTitle('Daily Routines');
      setRawPassage(defaultExample);
      const split = splitPassageIntoSentences(defaultExample);
      setSentences(
        split.map((text, idx) => ({
          id: `s_${Date.now()}_${idx}`,
          order: idx + 1,
          text,
        }))
      );
    }
  }, []);

  // Save draft whenever state changes
  useEffect(() => {
    clientStorage.setTeacherDraft({
      title,
      passage: rawPassage,
      exerciseMode,
      voiceMode,
      voiceAccent: voiceMode === 'UK' ? 'UK' : 'US',
      preferredVoiceName,
      preferredVoiceURI,
      preferredLang,
      pitch,
      playbackSpeed,
      listenLimit,
      checkMode,
    });
  }, [
    title,
    rawPassage,
    exerciseMode,
    voiceMode,
    preferredVoiceName,
    preferredVoiceURI,
    preferredLang,
    pitch,
    playbackSpeed,
    listenLimit,
    checkMode,
  ]);

  // Handle Split Passage
  const handleSplitPassage = () => {
    setErrorMessage('');
    if (!rawPassage.trim()) {
      setErrorMessage('Vui lòng nhập hoặc dán nội dung tiếng Anh trước khi tách câu.');
      return;
    }

    const split = splitPassageIntoSentences(rawPassage);
    if (split.length === 0) {
      setErrorMessage('Không nhận diện được câu nào từ đoạn văn.');
      return;
    }

    setSentences(
      split.map((text, idx) => ({
        id: `s_${Date.now()}_${idx}`,
        order: idx + 1,
        text,
      }))
    );
  };

  // Sentence manipulation
  const handleSentenceChange = (index: number, newText: string) => {
    const updated = [...sentences];
    updated[index] = { ...updated[index], text: newText };
    setSentences(updated);
  };

  const handleDeleteSentence = (index: number) => {
    const updated = sentences.filter((_, idx) => idx !== index);
    setSentences(
      updated.map((s, idx) => ({
        ...s,
        order: idx + 1,
      }))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...sentences];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setSentences(
      updated.map((s, idx) => ({
        ...s,
        order: idx + 1,
      }))
    );
  };

  const handleMoveDown = (index: number) => {
    if (index === sentences.length - 1) return;
    const updated = [...sentences];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setSentences(
      updated.map((s, idx) => ({
        ...s,
        order: idx + 1,
      }))
    );
  };

  const handleAddSentence = () => {
    setSentences([
      ...sentences,
      {
        id: `s_${Date.now()}_${sentences.length}`,
        order: sentences.length + 1,
        text: '',
      },
    ]);
  };

  // Preview Whole Voice Sample
  const handlePreviewVoiceSample = () => {
    if (isPlayingVoiceSample) {
      audioPlayer.stop();
      setIsPlayingVoiceSample(false);
      return;
    }

    setIsPlayingVoiceSample(true);
    setPlayingIndex(null);

    audioPlayer.play({
      text: PREVIEW_SENTENCE,
      voiceMode,
      preferredVoiceName: voiceMode === 'CUSTOM' ? preferredVoiceName : undefined,
      preferredVoiceURI: voiceMode === 'CUSTOM' ? preferredVoiceURI : undefined,
      preferredLang: voiceMode === 'CUSTOM' ? preferredLang : undefined,
      accent: voiceMode === 'UK' ? 'UK' : 'US',
      speed: playbackSpeed,
      pitch,
      onStart: () => setIsPlayingVoiceSample(true),
      onEnd: () => setIsPlayingVoiceSample(false),
      onError: () => setIsPlayingVoiceSample(false),
    });
  };

  // Preview Specific Sentence
  const handlePreviewAudio = (text: string, index: number) => {
    if (!text.trim()) return;

    if (playingIndex === index) {
      audioPlayer.stop();
      setPlayingIndex(null);
      return;
    }

    setIsPlayingVoiceSample(false);
    setPlayingIndex(index);

    audioPlayer.play({
      text,
      voiceMode,
      preferredVoiceName: voiceMode === 'CUSTOM' ? preferredVoiceName : undefined,
      preferredVoiceURI: voiceMode === 'CUSTOM' ? preferredVoiceURI : undefined,
      preferredLang: voiceMode === 'CUSTOM' ? preferredLang : undefined,
      accent: voiceMode === 'UK' ? 'UK' : 'US',
      speed: playbackSpeed,
      pitch,
      onStart: () => setPlayingIndex(index),
      onEnd: () => setPlayingIndex(null),
      onError: () => setPlayingIndex(null),
    });
  };

  // Handle Custom Voice Selection
  const handleCustomVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uri = e.target.value;
    const selected = availableVoices.find((v) => v.voiceURI === uri);
    if (selected) {
      setPreferredVoiceURI(selected.voiceURI);
      setPreferredVoiceName(selected.name);
      setPreferredLang(selected.lang);
    }
  };

  // Resolved active voice name for display
  const resolvedVoice = resolveVoice({
    voiceMode,
    preferredVoiceName: voiceMode === 'CUSTOM' ? preferredVoiceName : undefined,
    preferredVoiceURI: voiceMode === 'CUSTOM' ? preferredVoiceURI : undefined,
    preferredLang: voiceMode === 'CUSTOM' ? preferredLang : undefined,
    accent: voiceMode === 'UK' ? 'UK' : 'US',
  });

  // Generate Exercise Link
  const handleGenerate = () => {
    setErrorMessage('');
    const cleanTitle = title.trim() || 'English Dictation';
    const validSentences = sentences
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text.length > 0);

    if (validSentences.length === 0) {
      setErrorMessage('Bài tập cần có ít nhất 1 câu hoàn chỉnh.');
      return;
    }

    const exercise: DictationExercise = {
      title: cleanTitle,
      sentences: validSentences.map((s, idx) => ({
        id: s.id,
        order: idx + 1,
        text: s.text,
      })),
      exerciseMode,
      voiceMode,
      voiceAccent: voiceMode === 'UK' ? 'UK' : 'US',
      preferredVoiceName: voiceMode === 'CUSTOM' ? (preferredVoiceName || resolvedVoice?.name) : undefined,
      preferredVoiceURI: voiceMode === 'CUSTOM' ? (preferredVoiceURI || resolvedVoice?.voiceURI) : undefined,
      preferredLang: voiceMode === 'CUSTOM' ? (preferredLang || resolvedVoice?.lang) : undefined,
      pitch,
      playbackSpeed,
      listenLimit,
      checkMode,
      createdAt: new Date().toISOString(),
    };

    onGenerateShareLink(exercise);
  };

  return (
    <div id="teacher-create-view" className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            id="btn-back-home"
            onClick={onBackToHome}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-semibold text-sm px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Trang chủ</span>
          </button>
          <div className="text-center">
            <h1 className="font-extrabold text-slate-900 text-base sm:text-lg">Tạo bài Dictation mới</h1>
            <p className="text-xs text-slate-500">Mã hóa bài tập trực tiếp vào link</p>
          </div>
          <button
            id="btn-create-share-top"
            onClick={handleGenerate}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">TẠO LINK BÀI TẬP</span>
            <span className="sm:hidden">Tạo Link</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Card 1: Title & Raw Passage */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tên bài
            </label>
            <input
              id="input-exercise-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Daily Routines, Unit 1 Vocabulary..."
              className="w-full px-4 py-3 text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nội dung Dictation
              </label>
              <span className="text-xs text-slate-400">Dán cả đoạn hoặc từng dòng</span>
            </div>
            <textarea
              id="textarea-passage"
              rows={5}
              value={rawPassage}
              onChange={(e) => setRawPassage(e.target.value)}
              placeholder="Dán nội dung tiếng Anh vào đây..."
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-normal leading-relaxed"
            />
          </div>

          <button
            id="btn-split-sentences"
            onClick={handleSplitPassage}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
            <span>TÁCH THÀNH CÂU</span>
          </button>
        </section>

        {/* Card 2: Sentences List */}
        {sentences.length > 0 && (
          <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                  Danh sách câu ({sentences.length} câu)
                </span>
              </div>
              <button
                id="btn-add-sentence"
                onClick={handleAddSentence}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu</span>
              </button>
            </div>

            <div className="space-y-3">
              {sentences.map((sent, idx) => (
                <div
                  key={sent.id || idx}
                  id={`sentence-card-${idx}`}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 shrink-0">
                      Câu {idx + 1}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        title="Nghe thử câu này"
                        onClick={() => handlePreviewAudio(sent.text, idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                          playingIndex === idx
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${playingIndex === idx ? 'animate-bounce' : ''}`} />
                        <span>{playingIndex === idx ? 'Đang đọc...' : 'NGHE THỬ'}</span>
                      </button>

                      <button
                        title="Di chuyển lên"
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(idx)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Di chuyển xuống"
                        disabled={idx === sentences.length - 1}
                        onClick={() => handleMoveDown(idx)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Xóa câu"
                        onClick={() => handleDeleteSentence(idx)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-rose-100 border border-slate-200 flex items-center justify-center text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={sent.text}
                    onChange={(e) => handleSentenceChange(idx, e.target.value)}
                    placeholder="Nội dung câu..."
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Card 3: Audio & Voice Customization (Upgraded) */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center space-x-2">
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <span>Chất giọng & Tùy chọn đọc</span>
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              100% Miễn phí • Browser Native
            </span>
          </div>

          {/* Section: Chất giọng */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Chất giọng:
              </label>

              {/* Preview Button beside / right aligned */}
              <button
                type="button"
                id="btn-preview-voice-sample"
                onClick={handlePreviewVoiceSample}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  isPlayingVoiceSample
                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}
              >
                {isPlayingVoiceSample ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>DỪNG PHÁT</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>▶ NGHE THỬ GIỌNG</span>
                  </>
                )}
              </button>
            </div>

            {/* 4 Voice Mode Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                id="btn-voice-natural"
                onClick={() => setVoiceMode('NATURAL')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  voiceMode === 'NATURAL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center space-x-1">
                  <span>✨</span>
                  <span>Tự nhiên nhất</span>
                </span>
                <span className={`text-[10px] font-medium ${voiceMode === 'NATURAL' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  Tự chọn giọng tốt nhất
                </span>
              </button>

              <button
                type="button"
                id="btn-voice-us"
                onClick={() => setVoiceMode('US')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  voiceMode === 'US'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>🇺🇸 Anh-Mỹ</span>
                <span className={`text-[10px] font-medium ${voiceMode === 'US' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  en-US
                </span>
              </button>

              <button
                type="button"
                id="btn-voice-uk"
                onClick={() => setVoiceMode('UK')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  voiceMode === 'UK'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>🇬🇧 Anh-Anh</span>
                <span className={`text-[10px] font-medium ${voiceMode === 'UK' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  en-GB
                </span>
              </button>

              <button
                type="button"
                id="btn-voice-custom"
                onClick={() => {
                  setVoiceMode('CUSTOM');
                  if (!preferredVoiceURI && availableVoices.length > 0) {
                    setPreferredVoiceURI(availableVoices[0].voiceURI);
                    setPreferredVoiceName(availableVoices[0].name);
                    setPreferredLang(availableVoices[0].lang);
                  }
                }}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  voiceMode === 'CUSTOM'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>🎙 Chọn cụ thể</span>
                <span className={`text-[10px] font-medium ${voiceMode === 'CUSTOM' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {availableVoices.length > 0 ? `${availableVoices.length} giọng` : 'Đang tải...'}
                </span>
              </button>
            </div>

            {/* Custom Voice Dropdown (Visible when CUSTOM is selected) */}
            {voiceMode === 'CUSTOM' && (
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2 animate-in fade-in">
                <label htmlFor="select-custom-voice" className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Danh sách giọng tiếng Anh trên thiết bị của bạn:
                </label>
                {availableVoices.length > 0 ? (
                  <select
                    id="select-custom-voice"
                    value={preferredVoiceURI || resolvedVoice?.voiceURI || ''}
                    onChange={handleCustomVoiceChange}
                    className="w-full px-3 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} — {v.lang}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Đang quét danh sách giọng từ hệ thống trình duyệt...
                  </p>
                )}
              </div>
            )}

            {/* Current Voice Badge info */}
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-100/80 px-3 py-2 rounded-xl">
              <span className="truncate">
                🎙 Giọng đang kích hoạt:{' '}
                <strong className="text-slate-800 font-semibold">
                  {resolvedVoice ? `${resolvedVoice.name} (${resolvedVoice.lang})` : 'Mặc định hệ thống'}
                </strong>
              </span>
              <span className="shrink-0 text-[11px] text-indigo-600 font-bold ml-2">
                {resolvedVoice?.default ? '★ System default' : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            {/* Cao độ giọng (Pitch) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Cao độ giọng (Pitch)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {PITCH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    id={`btn-pitch-${opt.value}`}
                    onClick={() => setPitch(opt.value)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      pitch === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className={`text-[10px] font-normal ${pitch === opt.value ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tốc độ đọc (Speed) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tốc độ đọc
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd.value}
                    type="button"
                    id={`btn-speed-${spd.value}`}
                    onClick={() => setPlaybackSpeed(spd.value)}
                    className={`py-2 px-0.5 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      playbackSpeed === spd.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={spd.desc}
                  >
                    <div>{spd.label}</div>
                    <div className={`text-[9px] font-normal truncate ${playbackSpeed === spd.value ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {spd.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            {/* Số lượt nghe cho phép */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Số lần nghe
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([1, 2, 3, 0] as ListenLimit[]).map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    id={`btn-limit-${limit}`}
                    onClick={() => setListenLimit(limit)}
                    className={`py-2.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      listenLimit === limit
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {limit === 0 ? 'Vô hạn' : `${limit} lần`}
                  </button>
                ))}
              </div>
            </div>

            {/* Chế độ chấm điểm */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Chế độ chấm bài
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-mode-easy"
                  onClick={() => setCheckMode('EASY')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                    checkMode === 'EASY'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="font-extrabold">DỄ (Mặc định)</p>
                  <p className={`text-[10px] font-normal ${checkMode === 'EASY' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    Bỏ qua dấu câu & hoa/thường
                  </p>
                </button>
                <button
                  type="button"
                  id="btn-mode-strict"
                  onClick={() => setCheckMode('STRICT')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                    checkMode === 'STRICT'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="font-extrabold">CHÍNH XÁC</p>
                  <p className={`text-[10px] font-normal ${checkMode === 'STRICT' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    Bắt buộc đúng dấu, hoa, chữ
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Chế độ bài: LUYỆN TẬP / KIỂM TRA */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Chế độ bài tập (Exercise Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                id="btn-exercise-mode-practice"
                onClick={() => setExerciseMode('PRACTICE')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  exerciseMode === 'PRACTICE'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide">📖 LUYỆN TẬP (Mặc định)</span>
                  {exerciseMode === 'PRACTICE' && (
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-bold">Đang chọn</span>
                  )}
                </div>
                <p className={`text-[11px] mt-1 font-medium ${exerciseMode === 'PRACTICE' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  Có nút Gợi ý (💡) & Thử lại khi sai. Khuyên dùng cho bài tập về nhà.
                </p>
              </button>

              <button
                type="button"
                id="btn-exercise-mode-test"
                onClick={() => setExerciseMode('TEST')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  exerciseMode === 'TEST'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-1 ring-amber-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide">⏱️ KIỂM TRA</span>
                  {exerciseMode === 'TEST' && (
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-bold">Đang chọn</span>
                  )}
                </div>
                <p className={`text-[11px] mt-1 font-medium ${exerciseMode === 'TEST' ? 'text-amber-100' : 'text-slate-500'}`}>
                  Không hiện gợi ý & không thử lại. Chỉ chấm điểm và hiện đáp án sau khi làm xong.
                </p>
              </button>
            </div>
          </div>
        </section>

        {/* Final CTA Button */}
        <div className="pt-2">
          <button
            id="btn-generate-share-bottom"
            onClick={handleGenerate}
            className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-3 cursor-pointer"
          >
            <LinkIcon className="w-6 h-6 shrink-0" />
            <span>TẠO LINK BÀI TẬP</span>
          </button>
          <p className="text-center text-xs text-slate-500 mt-2.5">
            Link chứa toàn bộ dữ liệu bài tập • Không lưu dữ liệu vào máy chủ
          </p>
        </div>
      </main>
    </div>
  );
};
