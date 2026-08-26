import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Send,
  Play,
  Edit,
  Trash2,
  BookOpen,
  Volume2,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { SavedDictationItem, DictationExercise } from '../../types';
import { clientStorage } from '../../utils/storage';

interface DictationLibraryTabProps {
  onOpenCreateNew: () => void;
  onEditExercise: (item: SavedDictationItem) => void;
  onPreviewExercise: (exercise: DictationExercise) => void;
  onGenerateHomework: (item: SavedDictationItem) => void;
}

export const DictationLibraryTab: React.FC<DictationLibraryTabProps> = ({
  onOpenCreateNew,
  onEditExercise,
  onPreviewExercise,
  onGenerateHomework,
}) => {
  const [dictations, setDictations] = useState<SavedDictationItem[]>(() =>
    clientStorage.getSavedDictations()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Extract unique class levels for filtering
  const availableLevels = useMemo(() => {
    const levels = new Set<string>();
    dictations.forEach((d) => {
      if (d.classLevel?.trim()) levels.add(d.classLevel.trim());
    });
    return Array.from(levels);
  }, [dictations]);

  // Filtered dictations
  const filteredDictations = useMemo(() => {
    return dictations.filter((d) => {
      const matchQuery =
        !searchQuery.trim() ||
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.topic && d.topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.classLevel && d.classLevel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.passage && d.passage.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchLevel =
        selectedLevel === 'ALL' ||
        (d.classLevel && d.classLevel.toLowerCase() === selectedLevel.toLowerCase());

      return matchQuery && matchLevel;
    });
  }, [dictations, searchQuery, selectedLevel]);

  // Delete exercise
  const handleDelete = (id: string) => {
    clientStorage.deleteDictation(id);
    setDictations(clientStorage.getSavedDictations());
    setDeletingId(null);
  };

  return (
    <div id="dictation-library-tab" className="flex flex-col gap-5">
      {/* Top Controls & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-library"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên bài, chủ đề (Topic), khối lớp hoặc nội dung..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Create New Button */}
        <button
          id="btn-library-create-new"
          type="button"
          onClick={onOpenCreateNew}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo bài mới</span>
        </button>
      </div>

      {/* Class Level Filter Pills */}
      {availableLevels.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedLevel('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 cursor-pointer ${
              selectedLevel === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tất cả khối ({dictations.length})
          </button>
          {availableLevels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      )}

      {/* Exercises List / Grid */}
      {filteredDictations.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base mb-1">
            {searchQuery ? 'Không tìm thấy bài tập phù hợp' : 'Thư viện bài chưa có bài nào'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            {searchQuery
              ? 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
              : 'Tạo bài tập dictation để lưu vào thư viện và tái sử dụng cho nhiều lớp.'}
          </p>
          <button
            type="button"
            onClick={onOpenCreateNew}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            ➕ Tạo bài tập ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDictations.map((item) => {
            const ex = item.exercise;
            const isTest = ex.exerciseMode === 'TEST';

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-white border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                {/* Header info */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-extrabold text-slate-900 text-base leading-snug">
                          {item.title}
                        </span>
                        {item.classLevel && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                            {item.classLevel}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isTest
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isTest ? 'Kiểm tra' : 'Luyện tập'}
                        </span>
                      </div>
                      {item.topic && (
                        <p className="text-xs font-semibold text-amber-700">
                          🎯 Chủ đề: {item.topic}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Audio & sentence specs badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                      {ex.sentences.length} câu
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                      🔊 Giọng {ex.voiceAccent} • {ex.playbackSpeed}x
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                      {ex.checkMode === 'EASY' ? 'Chế độ Dễ' : 'Chính xác'}
                    </span>
                  </div>

                  {/* Sample Sentence Preview */}
                  <div className="mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 font-mono italic leading-relaxed line-clamp-2">
                    "{ex.sentences[0]?.text || item.passage}"
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Quick Preview & Edit & Delete */}
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => onPreviewExercise(ex)}
                      title="Làm thử bài tập"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditExercise(item)}
                      title="Chỉnh sửa bài tập"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(item.id)}
                      title="Xóa bài tập"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Main Action: Giao bài */}
                  <button
                    type="button"
                    onClick={() => onGenerateHomework(item)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>GIAO BÀI TẬP</span>
                  </button>
                </div>

                {/* Delete confirmation inline modal */}
                {deletingId === item.id && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
                    <span className="text-rose-800">Xác nhận xóa bài tập này?</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer"
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
