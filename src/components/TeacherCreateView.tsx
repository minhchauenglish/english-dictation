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
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { DictationExercise, DictationSentence, VoiceAccent, PlaybackSpeed, CheckMode, ListenLimit } from '../types';
import { splitPassageIntoSentences } from '../utils/textComparison';
import { audioPlayer } from '../utils/audioPlayer';
import { clientStorage } from '../utils/storage';

interface TeacherCreateViewProps {
  onBackToHome: () => void;
  onGenerateShareLink: (exercise: DictationExercise) => void;
}

export const TeacherCreateView: React.FC<TeacherCreateViewProps> = ({
  onBackToHome,
  onGenerateShareLink,
}) => {
  const [title, setTitle] = useState('');
  const [rawPassage, setRawPassage] = useState('');
  const [sentences, setSentences] = useState<DictationSentence[]>([]);
  const [voiceAccent, setVoiceAccent] = useState<VoiceAccent>('US');
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(0.85);
  const [listenLimit, setListenLimit] = useState<ListenLimit>(3);
  const [checkMode, setCheckMode] = useState<CheckMode>('EASY');
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Load draft on mount
  useEffect(() => {
    const draft = clientStorage.getTeacherDraft();
    if (draft) {
      setTitle(draft.title || '');
      setRawPassage(draft.passage || '');
      if (draft.voiceAccent) setVoiceAccent(draft.voiceAccent);
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
      voiceAccent,
      playbackSpeed,
      listenLimit,
      checkMode,
    });
  }, [title, rawPassage, voiceAccent, playbackSpeed, listenLimit, checkMode]);

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

  // Preview Speech
  const handlePreviewAudio = (text: string, index: number) => {
    if (!text.trim()) return;
    setPlayingIndex(index);
    audioPlayer.play({
      text,
      accent: voiceAccent,
      speed: playbackSpeed,
      onStart: () => setPlayingIndex(index),
      onEnd: () => setPlayingIndex(null),
      onError: () => setPlayingIndex(null),
    });
  };

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
      voiceAccent,
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

        {/* Card 3: Audio & Checking Settings */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
          <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">
            Tùy chọn đọc & Chấm điểm
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Giọng đọc */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Giọng đọc (Speech Synthesis)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-voice-us"
                  onClick={() => setVoiceAccent('US')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voiceAccent === 'US'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🇺🇸 Anh-Mỹ
                </button>
                <button
                  type="button"
                  id="btn-voice-uk"
                  onClick={() => setVoiceAccent('UK')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voiceAccent === 'UK'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🇬🇧 Anh-Anh
                </button>
              </div>
            </div>

            {/* Tốc độ đọc */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tốc độ đọc
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0.75, 0.85, 1.0, 1.15] as PlaybackSpeed[]).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    id={`btn-speed-${spd}`}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`py-2.5 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {spd}x {spd === 0.85 ? '⭐' : ''}
                  </button>
                ))}
              </div>
            </div>

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
