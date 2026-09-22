import React, { useState, useMemo } from 'react';
import {
  Mic2,
  Search,
  BookOpen,
  Play,
  Send,
  Edit,
  Trash2,
  FileUp,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { SavedDictationItem, DictationExercise } from '../../types';
import { clientStorage } from '../../utils/storage';
import { WordImportModal } from './WordImportModal';

interface DebateWorkspaceTabProps {
  onPreviewExercise: (exercise: DictationExercise) => void;
  onEditExercise: (item: SavedDictationItem) => void;
  onGenerateHomework: (item: SavedDictationItem) => void;
  onLibraryUpdated?: () => void;
}

export const DebateWorkspaceTab: React.FC<DebateWorkspaceTabProps> = ({
  onPreviewExercise,
  onEditExercise,
  onGenerateHomework,
  onLibraryUpdated,
}) => {
  const [dictations, setDictations] = useState<SavedDictationItem[]>(() =>
    clientStorage.getSavedDictations()
  );
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | '2' | '3' | '4'>('2');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isWordImportOpen, setIsWordImportOpen] = useState(false);

  // Filter only Debate lessons
  const debateLessons = useMemo(() => {
    return dictations.filter((d) => {
      const isDebate =
        d.group?.toUpperCase() === 'DEBATE' ||
        Boolean(d.level) ||
        /^[Ll][234]-/i.test(d.lessonCode || '') ||
        Boolean(d.classLevel && /DEBATE/i.test(d.classLevel));
      return isDebate;
    });
  }, [dictations]);

  // Compute counts per level
  const stats = useMemo(() => {
    const l2 = debateLessons.filter(
      (d) =>
        d.level === '2' ||
        (d.lessonCode && /^L2-/i.test(d.lessonCode)) ||
        (d.classLevel && /LEVEL\s*2/i.test(d.classLevel))
    ).length;
    const l3 = debateLessons.filter(
      (d) =>
        d.level === '3' ||
        (d.lessonCode && /^L3-/i.test(d.lessonCode)) ||
        (d.classLevel && /LEVEL\s*3/i.test(d.classLevel))
    ).length;
    const l4 = debateLessons.filter(
      (d) =>
        d.level === '4' ||
        (d.lessonCode && /^L4-/i.test(d.lessonCode)) ||
        (d.classLevel && /LEVEL\s*4/i.test(d.classLevel))
    ).length;
    return {
      total: debateLessons.length,
      l2,
      l3,
      l4,
    };
  }, [debateLessons]);

  // Filter lessons for the active view
  const filteredLessons = useMemo(() => {
    return debateLessons
      .filter((d) => {
        // Level filter
        if (selectedLevel !== 'ALL') {
          const itemLvl =
            d.level ||
            (d.lessonCode ? d.lessonCode.match(/^[Ll]([234])-/i)?.[1] : undefined) ||
            (d.classLevel ? d.classLevel.match(/LEVEL\s*([234])/i)?.[1] : undefined);
          if (itemLvl !== selectedLevel) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = !!(d.lessonCode && d.lessonCode.toLowerCase().includes(q));
          const matchTitle = d.title.toLowerCase().includes(q);
          const matchTopic = !!(d.topic && d.topic.toLowerCase().includes(q));
          const matchPassage = !!(d.passage && d.passage.toLowerCase().includes(q));
          return matchCode || matchTitle || matchTopic || matchPassage;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by lessonCode or lessonNumber
        const codeA = a.lessonCode || '';
        const codeB = b.lessonCode || '';
        if (codeA && codeB) {
          return codeA.localeCompare(codeB, undefined, { numeric: true });
        }
        return (a.lessonNumber || 0) - (b.lessonNumber || 0);
      });
  }, [debateLessons, selectedLevel, searchQuery]);

  const handleDelete = (id: string) => {
    clientStorage.deleteDictation(id);
    const updated = clientStorage.getSavedDictations();
    setDictations(updated);
    setDeletingId(null);
    onLibraryUpdated?.();
  };

  const handleWordImportSuccess = () => {
    const updated = clientStorage.getSavedDictations();
    setDictations(updated);
    onLibraryUpdated?.();
  };

  return (
    <div id="debate-workspace-tab" className="flex flex-col gap-5">
      {/* Top Banner & Audit Overview */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-sm border border-purple-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-700/50 border border-purple-500/40 text-purple-200 text-xs font-black uppercase tracking-wider">
              <Mic2 className="w-3.5 h-3.5" />
              <span>Chương trình Tranh biện tiếng Anh (Debate Program)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Khu vực Tranh biện • Level 2, 3 & 4
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/90 font-medium">
              Luyện nghe và ghi chép bài mẫu tranh biện (Sample Speeches & Arguments) với 90 chủ đề
              chuẩn mỗi level (L2-001 → L4-090).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsWordImportOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-purple-50 text-purple-900 font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center space-x-2 cursor-pointer"
            >
              <FileUp className="w-4 h-4 text-purple-700" />
              <span>📥 Import Word Debate</span>
            </button>
          </div>
        </div>

        {/* 3 Level Progress Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-5 mt-4 border-t border-purple-700/40">
          <div
            onClick={() => setSelectedLevel('2')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              selectedLevel === '2'
                ? 'bg-purple-800/80 border-purple-400 shadow-sm'
                : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-850'
            }`}
          >
            <div className="text-xs font-bold text-purple-300">DEBATE LEVEL 2</div>
            <div className="text-lg font-black text-white mt-0.5">
              {stats.l2} <span className="text-xs text-purple-300 font-normal">/ 90 bài</span>
            </div>
            <div className="text-[11px] text-purple-300/80 mt-1">L2-001 → L2-090</div>
          </div>

          <div
            onClick={() => setSelectedLevel('3')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              selectedLevel === '3'
                ? 'bg-purple-800/80 border-purple-400 shadow-sm'
                : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-850'
            }`}
          >
            <div className="text-xs font-bold text-purple-300">DEBATE LEVEL 3</div>
            <div className="text-lg font-black text-white mt-0.5">
              {stats.l3} <span className="text-xs text-purple-300 font-normal">/ 90 bài</span>
            </div>
            <div className="text-[11px] text-purple-300/80 mt-1">L3-001 → L3-090</div>
          </div>

          <div
            onClick={() => setSelectedLevel('4')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              selectedLevel === '4'
                ? 'bg-purple-800/80 border-purple-400 shadow-sm'
                : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-850'
            }`}
          >
            <div className="text-xs font-bold text-purple-300">DEBATE LEVEL 4</div>
            <div className="text-lg font-black text-white mt-0.5">
              {stats.l4} <span className="text-xs text-purple-300 font-normal">/ 90 bài</span>
            </div>
            <div className="text-[11px] text-purple-300/80 mt-1">L4-001 → L4-090</div>
          </div>

          <div
            onClick={() => setSelectedLevel('ALL')}
            className={`p-3 rounded-2xl cursor-pointer transition-all border ${
              selectedLevel === 'ALL'
                ? 'bg-purple-800/80 border-purple-400 shadow-sm'
                : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-850'
            }`}
          >
            <div className="text-xs font-bold text-purple-300">TỔNG CỘNG 3 LEVEL</div>
            <div className="text-lg font-black text-white mt-0.5">
              {stats.total} <span className="text-xs text-purple-300 font-normal">/ 270 bài</span>
            </div>
            <div className="text-[11px] text-purple-300/80 mt-1">Toàn bộ kho bài Debate</div>
          </div>
        </div>
      </div>

      {/* Level Selection Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Level Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedLevel('2')}
            className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer whitespace-nowrap ${
              selectedLevel === '2'
                ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-purple-50'
            }`}
          >
            LEVEL 2 ({stats.l2}/90)
          </button>

          <button
            type="button"
            onClick={() => setSelectedLevel('3')}
            className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer whitespace-nowrap ${
              selectedLevel === '3'
                ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-purple-50'
            }`}
          >
            LEVEL 3 ({stats.l3}/90)
          </button>

          <button
            type="button"
            onClick={() => setSelectedLevel('4')}
            className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer whitespace-nowrap ${
              selectedLevel === '4'
                ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-purple-50'
            }`}
          >
            LEVEL 4 ({stats.l4}/90)
          </button>

          <button
            type="button"
            onClick={() => setSelectedLevel('ALL')}
            className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer whitespace-nowrap ${
              selectedLevel === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tất cả ({stats.total})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã bài (L2-001), chủ đề..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium shadow-2xs"
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
      </div>

      {/* Lesson List */}
      {filteredLessons.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Mic2 className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900">
            Chưa có bài học Debate nào trong mục này
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Nhấn nút <strong>Import Word Debate</strong> ở trên để nhập dữ liệu các Level 2, 3 và 4
            vào hệ thống.
          </p>
          <button
            type="button"
            onClick={() => setIsWordImportOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all inline-flex items-center space-x-2 cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Import file Word Debate</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLessons.map((item) => {
            const sentenceCount = item.exercise?.sentences?.length || 0;
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-purple-300 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-3 group"
              >
                <div>
                  {/* Top Bar: Code, Level, Sentences */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center space-x-2 flex-wrap">
                      {item.lessonCode && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-900 text-white text-xs font-black tracking-wide">
                          {item.lessonCode}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold">
                        Level {item.level || '2/3/4'}
                      </span>
                      {item.translation && (
                        <span className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
                          🇻🇳 Dịch
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 font-semibold">
                      {sentenceCount} câu
                    </span>
                  </div>

                  {/* Title / Question */}
                  <h4 className="font-black text-slate-900 text-sm sm:text-base leading-snug group-hover:text-purple-900 transition-colors">
                    {item.title}
                  </h4>

                  {/* Sample Speech Passage Preview */}
                  {item.passage && (
                    <p className="text-xs text-slate-600 font-medium line-clamp-3 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {item.passage}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => onPreviewExercise(item.exercise)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                      title="Luyện nghe chính tả bài này"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Luyện nghe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onGenerateHomework(item)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                      title="Tạo link bài tập về nhà"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Giao bài</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => onEditExercise(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Chỉnh sửa nội dung"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-[11px] cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Xóa bài này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Word Import Modal */}
      <WordImportModal
        isOpen={isWordImportOpen}
        onClose={() => setIsWordImportOpen(false)}
        onImportSuccess={handleWordImportSuccess}
      />
    </div>
  );
};
