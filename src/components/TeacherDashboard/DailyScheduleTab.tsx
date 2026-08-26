import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Sparkles,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Plus,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Layers,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  TeacherClass,
  SavedDictationItem,
  DictationExercise,
} from '../../types';
import { clientStorage } from '../../utils/storage';

interface DailyScheduleTabProps {
  onOpenDailyDispatch: () => void;
  onPreviewExercise: (exercise: DictationExercise) => void;
  onOpenCreateNew: () => void;
  onNavigateToClasses: () => void;
}

export const DailyScheduleTab: React.FC<DailyScheduleTabProps> = ({
  onOpenDailyDispatch,
  onPreviewExercise,
  onOpenCreateNew,
  onNavigateToClasses,
}) => {
  const [classes, setClasses] = useState<TeacherClass[]>(() =>
    clientStorage.getTeacherClasses()
  );
  const [library, setLibrary] = useState<SavedDictationItem[]>(() =>
    clientStorage.getSavedDictations()
  );
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    clientStorage.getClassAssignments()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Reload data
  const reloadData = () => {
    setClasses(clientStorage.getTeacherClasses());
    setLibrary(clientStorage.getSavedDictations());
    setAssignments(clientStorage.getClassAssignments());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Today formatted string
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  // Calculate stats
  const assignedCount = useMemo(() => {
    return classes.filter((c) => !!assignments[c.id]).length;
  }, [classes, assignments]);

  // Filtered classes based on search
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const q = searchQuery.toLowerCase().trim();
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.gradeLevel && c.gradeLevel.toLowerCase().includes(q))
    );
  }, [classes, searchQuery]);

  // Handle single class assignment change
  const handleAssignChange = (classId: string, dictationId: string) => {
    clientStorage.setClassAssignment(classId, dictationId || null);
    setAssignments(clientStorage.getClassAssignments());
    showToast('Đã lưu thiết lập bài tập!');
  };

  // Quick auto-assign cycler (spreads library items across classes)
  const handleAutoAssign = () => {
    if (library.length === 0) return;
    const newMapping: Record<string, string> = {};
    classes.forEach((cls, idx) => {
      // First try to match by class name keywords (e.g. Grade 3 -> Grade 3)
      const matchingLib = library.find(
        (lib) =>
          lib.classLevel &&
          cls.name.toLowerCase().includes(lib.classLevel.toLowerCase().trim())
      );
      if (matchingLib) {
        newMapping[cls.id] = matchingLib.id;
      } else {
        // Otherwise cycle through available library
        const libItem = library[idx % library.length];
        newMapping[cls.id] = libItem.id;
      }
    });
    clientStorage.saveAllClassAssignments(newMapping);
    setAssignments(newMapping);
    showToast('⚡ Đã tự động gán bài từ thư viện cho tất cả các lớp!');
  };

  // Reset to default starter mapping
  const handleResetDefaults = () => {
    const res = clientStorage.resetClassAssignmentsToDefaults();
    setAssignments(res);
    showToast('Đã khôi phục thiết lập lịch giao bài mẫu!');
  };

  // Clear all mappings
  const handleClearAllMappings = () => {
    clientStorage.saveAllClassAssignments({});
    setAssignments({});
    showToast('Đã bỏ gán bài cho tất cả các lớp.');
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  return (
    <div id="daily-schedule-tab" className="flex flex-col gap-6">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Top Banner: Daily Dispatch Callout */}
      <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5 z-10 max-w-xl">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-bold flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Hôm nay: {todayFormatted}</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              {assignedCount}/{classes.length} lớp đã sẵn sàng
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Lịch giao bài mặc định theo lớp
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
            Thiết lập sẵn bài Dictation cho từng lớp. Bấm{' '}
            <strong className="text-emerald-300 font-extrabold">
              "GIAO BÀI HÔM NAY"
            </strong>{' '}
            để tự động sinh link riêng và tạo sẵn tin nhắn Zalo cho 12 lớp trong 1 giây!
          </p>
        </div>

        {/* Big Action Button */}
        <div className="z-10 shrink-0 w-full md:w-auto flex flex-col sm:flex-row md:flex-col gap-2">
          <button
            id="btn-trigger-daily-dispatch-banner"
            type="button"
            onClick={onOpenDailyDispatch}
            disabled={assignedCount === 0}
            className="w-full px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center space-x-2.5 cursor-pointer transform hover:-translate-y-0.5"
          >
            <Rocket className="w-5 h-5 text-white" />
            <span>🚀 GIAO BÀI HÔM NAY ({assignedCount} LỚP)</span>
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Control Bar: Quick Mapping Helpers */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên lớp (KID1A, Grade 3A...)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Quick Batch Setup Actions */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          <button
            type="button"
            onClick={handleAutoAssign}
            className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors flex items-center space-x-1.5 whitespace-nowrap cursor-pointer"
            title="Tự động gán các bài từ thư viện cho danh sách lớp"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>⚡ Gán nhanh theo thư viện</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center space-x-1.5 whitespace-nowrap cursor-pointer"
            title="Khôi phục danh sách mẫu ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Khôi phục mẫu</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToClasses}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center space-x-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Quản lý lớp ({classes.length})</span>
          </button>
        </div>
      </div>

      {/* Main Class List Mapping Table / Cards */}
      {classes.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base mb-1">
            Chưa có lớp học nào trong danh sách
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            Hãy thêm các lớp học của bạn để thiết lập lịch giao bài tập hằng ngày.
          </p>
          <button
            type="button"
            onClick={onNavigateToClasses}
            className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-indigo-700 cursor-pointer"
          >
            + Thêm lớp học ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls, index) => {
            const assignedDictId = assignments[cls.id];
            const currentItem = library.find((x) => x.id === assignedDictId);

            return (
              <div
                key={cls.id}
                id={`card-class-mapping-${cls.id}`}
                className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all flex flex-col justify-between gap-3 shadow-xs ${
                  currentItem
                    ? 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                {/* Card Top: Class Name & Status Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-black text-slate-900 text-base sm:text-lg leading-tight">
                        {cls.name}
                      </h4>
                      {cls.gradeLevel && (
                        <p className="text-[11px] font-semibold text-slate-500">
                          {cls.gradeLevel} {cls.studentCount ? `• ${cls.studentCount} học sinh` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {currentItem ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Đã có bài</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-extrabold flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Chưa gán bài</span>
                    </span>
                  )}
                </div>

                {/* Card Middle: Dictation Assignment Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Bài Dictation giao hôm nay:
                  </label>

                  <select
                    id={`select-dictation-for-${cls.id}`}
                    value={assignedDictId || ''}
                    onChange={(e) => handleAssignChange(cls.id, e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors"
                  >
                    <option value="">-- Chọn bài từ thư viện ({library.length} bài) --</option>
                    {library.map((lib) => (
                      <option key={lib.id} value={lib.id}>
                        {lib.title} {lib.topic ? `(${lib.topic})` : ''} — {lib.exercise.sentences.length} câu
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Bottom: Current Assigned Item Detail & Preview */}
                {currentItem ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-indigo-700 line-clamp-1">
                          {currentItem.title}
                        </p>
                        {currentItem.topic && (
                          <p className="text-[11px] font-medium text-slate-500 line-clamp-1">
                            {currentItem.topic}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                          {currentItem.exercise.sentences.length} câu
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                          {currentItem.exercise.playbackSpeed}x
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => onPreviewExercise(currentItem.exercise)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                        <span>Xem trước bài tập</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAssignChange(cls.id, '')}
                        className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        Bỏ gán
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-dashed border-amber-200 text-center">
                    <p className="text-xs font-semibold text-amber-800 mb-1">
                      Lớp này chưa được gán bài hôm nay
                    </p>
                    <p className="text-[11px] text-amber-600">
                      Hãy chọn bài từ menu ở trên hoặc bấm "Gán nhanh"
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Sticky Action Bar on Mobile/Desktop */}
      <div className="sticky bottom-4 z-20 w-full p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 text-xs sm:text-sm font-bold text-slate-700">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Đã gán <strong className="text-indigo-600">{assignedCount}/{classes.length}</strong> lớp học cho ngày {todayFormatted}
          </span>
        </div>

        <button
          id="btn-bottom-launch-daily-dispatch"
          type="button"
          onClick={onOpenDailyDispatch}
          disabled={assignedCount === 0}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-black text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Rocket className="w-4 h-4 text-white" />
          <span>🚀 GIAO BÀI HÔM NAY ({assignedCount} LỚP)</span>
        </button>
      </div>
    </div>
  );
};
