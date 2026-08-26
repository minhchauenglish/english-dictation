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
  Save,
  Send,
  Check,
  BookOpen,
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
  SavedDictationItem,
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
  onOpenHomeworkModal?: (exercise: DictationExercise, classLevel?: string, topic?: string) => void;
  onSavedToLibrary?: (savedItem: SavedDictationItem) => void;
  editingItem?: SavedDictationItem | null;
  onCancelEdit?: () => void;
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
  onOpenHomeworkModal,
  onSavedToLibrary,
  editingItem,
  onCancelEdit,
}) => {
  const [title, setTitle] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [topic, setTopic] = useState('');
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
  const [saveSuccessToast, setSaveSuccessToast] = useState('');

  // Subscribe to voices list
  useEffect(() => {
    const unsubscribe = subscribeToVoices((voices) => {
      const en = filterEnglishVoices(voices);
      setAvailableVoices(en);
    });
    return unsubscribe;
  }, []);

  // Load from editingItem or draft on mount / editingItem change
  useEffect(() => {
    if (editingItem) {
      setTitle(editingItem.title || '');
      setClassLevel(editingItem.classLevel || '');
      setTopic(editingItem.topic || '');
      setRawPassage(editingItem.passage || '');
      setSentences(editingItem.exercise.sentences || []);
      setExerciseMode(editingItem.exercise.exerciseMode || 'PRACTICE');
      setVoiceMode(editingItem.exercise.voiceMode || 'NATURAL');
      setPreferredVoiceName(editingItem.exercise.preferredVoiceName || '');
      setPreferredVoiceURI(editingItem.exercise.preferredVoiceURI || '');
      setPreferredLang(editingItem.exercise.preferredLang || '');
      setPitch(editingItem.exercise.pitch || 1.0);
      setPlaybackSpeed(editingItem.exercise.playbackSpeed || 0.95);
      setListenLimit(editingItem.exercise.listenLimit ?? 3);
      setCheckMode(editingItem.exercise.checkMode || 'EASY');
    } else {
      const draft = clientStorage.getTeacherDraft();
      if (draft) {
        setTitle(draft.title || '');
        setClassLevel(draft.classLevel || '');
        setTopic(draft.topic || '');
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
        const defaultExample =
          "I get up at six o'clock every morning.\nI have breakfast with my family.\nI go to school by bus.\nI like English very much.\nI do my homework in the evening.";
        setTitle('Daily Routines');
        setClassLevel('Grade 3');
        setTopic('Unit 2: My Daily Life');
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
    }
  }, [editingItem]);

  // Save draft whenever state changes (if not editing an item)
  useEffect(() => {
    if (!editingItem) {
      clientStorage.setTeacherDraft({
        title,
        classLevel,
        topic,
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
    }
  }, [
    editingItem,
    title,
    classLevel,
    topic,
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
      text: text.trim(),
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

  // Build validated exercise object
  const buildExerciseObject = (): DictationExercise | null => {
    setErrorMessage('');
    const validSentences = sentences
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text.length > 0);

    if (validSentences.length === 0) {
      setErrorMessage('Bài tập cần có ít nhất 1 câu tiếng Anh hợp lệ.');
      return null;
    }

    return {
      title: title.trim() || 'English Dictation Practice',
      sentences: validSentences.map((s, idx) => ({ ...s, order: idx + 1 })),
      exerciseMode,
      voiceMode,
      voiceAccent: voiceMode === 'UK' ? 'UK' : 'US',
      preferredVoiceName: voiceMode === 'CUSTOM' ? preferredVoiceName : undefined,
      preferredVoiceURI: voiceMode === 'CUSTOM' ? preferredVoiceURI : undefined,
      preferredLang: voiceMode === 'CUSTOM' ? preferredLang : undefined,
      pitch,
      playbackSpeed,
      listenLimit,
      checkMode,
      createdAt: new Date().toISOString(),
    };
  };

  // Action: Save to Library
  const handleSaveToLibrary = () => {
    const ex = buildExerciseObject();
    if (!ex) return;

    const saved = clientStorage.saveDictation({
      id: editingItem?.id,
      title: ex.title,
      classLevel: classLevel.trim() || 'Toàn trường',
      topic: topic.trim() || 'Luyện nghe phản xạ',
      passage: rawPassage.trim() || sentences.map((s) => s.text).join('\n'),
      exercise: ex,
    });

    setSaveSuccessToast('Đã lưu bài vào Thư viện thành công!');
    setTimeout(() => setSaveSuccessToast(''), 3000);

    if (onSavedToLibrary) {
      onSavedToLibrary(saved);
    }
  };

  // Action: Generate Homework for Classes
  const handleOpenHomework = () => {
    const ex = buildExerciseObject();
    if (!ex) return;

    if (onOpenHomeworkModal) {
      onOpenHomeworkModal(ex, classLevel, topic);
    } else {
      onGenerateShareLink(ex);
    }
  };

  // Action: Legacy Direct Link
  const handleGenerateLink = () => {
    const ex = buildExerciseObject();
    if (!ex) return;
    onGenerateShareLink(ex);
  };

  return (
    <div id="teacher-create-view" className="min-h-screen bg-slate-100/60 pb-20">
      {/* Top Banner if Editing */}
      {editingItem && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>Đang chỉnh sửa bài tập: "{editingItem.title}"</span>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-2.5 py-1 bg-white text-amber-900 rounded-lg text-xs font-black hover:bg-amber-50 cursor-pointer"
            >
              Hủy sửa & Về thư viện
            </button>
          )}
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccessToast && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center space-x-2.5 animate-in fade-in">
            <Check className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{saveSuccessToast}</span>
          </div>
        )}

        {/* Card 1: Title, Level, Topic & Raw Passage */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên bài tập (Title) *
              </label>
              <input
                id="input-exercise-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Daily Routines, Animals and Pets..."
                className="w-full px-4 py-3 text-base rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Khối lớp (Class Level)
              </label>
              <input
                id="input-exercise-level"
                type="text"
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                placeholder="Ví dụ: Grade 3, KID 1..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chủ đề / Unit (Topic)
              </label>
              <input
                id="input-exercise-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: Unit 4: My Family, Hobbies & Sports..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nội dung Dictation tiếng Anh *
              </label>
              <span className="text-xs text-slate-400">Dán cả đoạn hoặc từng câu</span>
            </div>
            <textarea
              id="textarea-passage"
              rows={5}
              value={rawPassage}
              onChange={(e) => setRawPassage(e.target.value)}
              placeholder="Dán nội dung tiếng Anh vào đây..."
              className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-normal leading-relaxed text-slate-800"
            />
          </div>

          <button
            id="btn-split-sentences"
            type="button"
            onClick={handleSplitPassage}
            className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
            <span>TÁCH THÀNH CÂU TIẾNG ANH</span>
          </button>
        </section>

        {/* Card 2: Sentences List */}
        {sentences.length > 0 && (
          <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                  Danh sách câu ({sentences.length} câu)
                </span>
              </div>
              <button
                id="btn-add-sentence"
                type="button"
                onClick={handleAddSentence}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
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
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 shrink-0">
                      Câu {idx + 1}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        title="Nghe thử câu này"
                        onClick={() => handlePreviewAudio(sent.text, idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                          playingIndex === idx
                            ? 'bg-rose-600 text-white'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {playingIndex === idx ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Dừng</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Nghe thử</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        title="Di chuyển lên"
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        title="Di chuyển xuống"
                        disabled={idx === sentences.length - 1}
                        onClick={() => handleMoveDown(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        title="Xóa câu"
                        onClick={() => handleDeleteSentence(idx)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={sent.text}
                    onChange={(e) => handleSentenceChange(idx, e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                    placeholder="Nhập nội dung câu tiếng Anh..."
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Card 3: Audio Settings */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                Cài đặt âm thanh & giọng đọc
              </h3>
            </div>

            {/* Test Voice Sample Button */}
            <button
              id="btn-preview-voice"
              type="button"
              onClick={handlePreviewVoiceSample}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer ${
                isPlayingVoiceSample
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isPlayingVoiceSample ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng giọng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Nghe thử giọng</span>
                </>
              )}
            </button>
          </div>

          {/* Voice Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              1. Chế độ giọng đọc tiếng Anh
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                id="btn-voice-mode-natural"
                onClick={() => setVoiceMode('NATURAL')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  voiceMode === 'NATURAL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-extrabold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tự nhiên nhất</span>
                </span>
                <span className={`text-[10px] font-medium ${voiceMode === 'NATURAL' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  Tự chọn giọng tốt nhất
                </span>
              </button>

              <button
                type="button"
                id="btn-voice-mode-us"
                onClick={() => setVoiceMode('US')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  voiceMode === 'US'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-extrabold">🇺🇸 Giọng Mỹ (US)</span>
                <span className={`text-[10px] font-medium ${voiceMode === 'US' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  American English
                </span>
              </button>

              <button
                type="button"
                id="btn-voice-mode-uk"
                onClick={() => setVoiceMode('UK')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  voiceMode === 'UK'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-extrabold">🇬🇧 Giọng Anh (UK)</span>
                <span className={`text-[10px] font-medium ${voiceMode === 'UK' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  British English
                </span>
              </button>

              <button
                type="button"
                id="btn-voice-mode-custom"
                onClick={() => setVoiceMode('CUSTOM')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  voiceMode === 'CUSTOM'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-extrabold flex items-center space-x-1">
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Tùy chọn giọng</span>
                </span>
                <span className={`text-[10px] font-medium ${voiceMode === 'CUSTOM' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  Chọn trong máy
                </span>
              </button>
            </div>

            {/* Custom Voice Dropdown if CUSTOM selected */}
            {voiceMode === 'CUSTOM' && (
              <div className="mt-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-2 animate-in fade-in">
                <label className="block text-xs font-bold text-indigo-900">
                  Chọn giọng đọc khả dụng trên thiết bị ({availableVoices.length} giọng):
                </label>
                <select
                  value={preferredVoiceURI}
                  onChange={(e) => {
                    const uri = e.target.value;
                    setPreferredVoiceURI(uri);
                    const v = availableVoices.find((x) => x.voiceURI === uri);
                    if (v) {
                      setPreferredVoiceName(v.name);
                      setPreferredLang(v.lang);
                    }
                  }}
                  className="w-full p-2.5 text-xs bg-white rounded-xl border border-indigo-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Tự động chọn giọng tốt nhất --</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Speed & Pitch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            {/* Speed Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. Tốc độ đọc (Speed)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlaybackSpeed(opt.value)}
                    className={`py-2 px-1 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                      playbackSpeed === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className={`text-[9px] font-normal ${playbackSpeed === opt.value ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                3. Cao độ giọng (Pitch)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {PITCH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPitch(opt.value)}
                    className={`py-2 px-1 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                      pitch === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className={`text-[9px] font-normal ${pitch === opt.value ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Limits & Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            {/* Giới hạn lượt nghe */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Số lần nghe tối đa mỗi câu
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as ListenLimit[]).map((limit) => (
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

        {/* PRIMARY ACTION BUTTONS: Multi-Class Homework, Save to Library, Direct Link */}
        <div className="pt-2 flex flex-col gap-3">
          {/* Main 1-Click Multi-Class Homework Button */}
          <button
            id="btn-generate-homework-for-classes"
            type="button"
            onClick={handleOpenHomework}
            className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-3 cursor-pointer active:scale-[0.99]"
          >
            <Send className="w-6 h-6 shrink-0" />
            <span>🚀 GIAO BÀI CHO CÁC LỚP (TẠO LINK & LỜI NHẮN ZALO)</span>
          </button>

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-save-to-library"
              type="button"
              onClick={handleSaveToLibrary}
              className="py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4 text-indigo-600" />
              <span>💾 LƯU VÀO THƯ VIỆN BÀI TẬP</span>
            </button>

            <button
              id="btn-generate-direct-link"
              type="button"
              onClick={handleGenerateLink}
              className="py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LinkIcon className="w-4 h-4 text-indigo-600" />
              <span>🔗 TẠO LINK TRỰC TIẾP / MÃ QR</span>
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 mt-1">
            Không cần máy chủ • Toàn bộ bài tập và dữ liệu lớp được lưu an toàn trên máy của bạn
          </p>
        </div>
      </main>
    </div>
  );
};
