import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  PlusCircle,
  BookOpen,
  Users,
  Clock,
  Sparkles,
  Send,
  PenTool,
  Calendar,
  Rocket,
  CheckCircle2,
} from 'lucide-react';
import {
  DictationExercise,
  SavedDictationItem,
  TeacherClass,
  HomeworkHistoryItem,
} from '../../types';
import { clientStorage } from '../../utils/storage';
import { DailyScheduleTab } from './DailyScheduleTab';
import { DictationLibraryTab } from './DictationLibraryTab';
import { ClassManagementTab } from './ClassManagementTab';
import { HomeworkHistoryTab } from './HomeworkHistoryTab';
import { HomeworkGenerateModal } from './HomeworkGenerateModal';
import { DailyHomeworkModal } from './DailyHomeworkModal';
import { TeacherCreateView } from '../TeacherCreateView';

export type TeacherDashboardTab = 'schedule' | 'library' | 'create' | 'classes' | 'history';

interface TeacherDashboardViewProps {
  onBackToHome: () => void;
  onPreviewExercise: (exercise: DictationExercise) => void;
  onGenerateShareLink: (exercise: DictationExercise) => void;
  initialTab?: TeacherDashboardTab;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  onBackToHome,
  onPreviewExercise,
  onGenerateShareLink,
  initialTab = 'schedule',
}) => {
  const [activeTab, setActiveTab] = useState<TeacherDashboardTab>(initialTab);
  const [editingItem, setEditingItem] = useState<SavedDictationItem | null>(null);
  const [isDailyDispatchOpen, setIsDailyDispatchOpen] = useState(false);
  const [homeworkModalData, setHomeworkModalData] = useState<{
    exercise: DictationExercise;
    classLevel?: string;
    topic?: string;
  } | null>(null);

  // Quick live metrics
  const [savedCount, setSavedCount] = useState<number>(0);
  const [classCount, setClassCount] = useState<number>(0);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [assignedCount, setAssignedCount] = useState<number>(0);

  // Today formatted date
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  // Refresh counts
  const refreshCounts = () => {
    const classes = clientStorage.getTeacherClasses();
    const library = clientStorage.getSavedDictations();
    const history = clientStorage.getHomeworkHistory();
    const assignments = clientStorage.getClassAssignments();

    setSavedCount(library.length);
    setClassCount(classes.length);
    setHistoryCount(history.length);
    setAssignedCount(classes.filter((c) => !!assignments[c.id]).length);
  };

  useEffect(() => {
    refreshCounts();
  }, [activeTab, isDailyDispatchOpen, homeworkModalData]);

  // Handler: Start creating fresh exercise
  const handleOpenCreateNew = () => {
    setEditingItem(null);
    setActiveTab('create');
  };

  // Handler: Edit an existing library exercise
  const handleEditExercise = (item: SavedDictationItem) => {
    setEditingItem(item);
    setActiveTab('create');
  };

  // Handler: Open Homework Generator Modal for an item
  const handleOpenHomeworkForSavedItem = (item: SavedDictationItem) => {
    setHomeworkModalData({
      exercise: item.exercise,
      classLevel: item.classLevel,
      topic: item.topic,
    });
  };

  // Handler: Open Homework Generator Modal from Create Screen
  const handleOpenHomeworkFromCreate = (
    exercise: DictationExercise,
    classLevel?: string,
    topic?: string
  ) => {
    setHomeworkModalData({
      exercise,
      classLevel,
      topic,
    });
  };

  // Handler: Saved to Library from Create Screen
  const handleSavedToLibrary = (savedItem: SavedDictationItem) => {
    refreshCounts();
    setEditingItem(null);
    setActiveTab('library');
  };

  return (
    <div
      id="teacher-dashboard-view"
      className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col"
    >
      {/* Top Main Navigation Bar */}
      <header
        id="teacher-dashboard-header"
        className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Brand & Back Button */}
          <div className="flex items-center space-x-3">
            <button
              id="btn-back-to-home"
              type="button"
              onClick={onBackToHome}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors flex items-center space-x-1.5 text-xs sm:text-sm font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Trang chủ</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-200" />

            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
                GV
              </div>
              <div>
                <h1 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                  Khu vực Giáo viên <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100 ml-1">V1.2</span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  Daily Homework Manager • Giao bài 12 lớp trong 1 giây • Tự động tạo tin nhắn Zalo
                </p>
              </div>
            </div>
          </div>

          {/* Quick "Giao nhanh" Top Bar Action */}
          <div className="flex items-center space-x-2 justify-end overflow-x-auto pb-1 sm:pb-0 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shrink-0 hidden md:flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{todayFormatted}</span>
              <span className="text-slate-300">|</span>
              <span>{classCount} lớp ({assignedCount} bài)</span>
            </div>

            <button
              id="btn-header-quick-dispatch"
              type="button"
              onClick={() => setIsDailyDispatchOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>🚀 GIAO TẤT CẢ</span>
            </button>
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none border-t border-slate-100">
          {/* Tab 1: Daily Schedule Mapping */}
          <button
            id="tab-btn-schedule"
            type="button"
            onClick={() => {
              setEditingItem(null);
              setActiveTab('schedule');
            }}
            className={`py-3 px-3.5 sm:px-4 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'schedule'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>📅 Lịch giao bài ({assignedCount}/{classCount})</span>
          </button>

          {/* Tab 2: Dictation Library */}
          <button
            id="tab-btn-library"
            type="button"
            onClick={() => {
              setEditingItem(null);
              setActiveTab('library');
            }}
            className={`py-3 px-3.5 sm:px-4 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'library'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Thư viện bài tập ({savedCount})</span>
          </button>

          {/* Tab 3: Create */}
          <button
            id="tab-btn-create"
            type="button"
            onClick={handleOpenCreateNew}
            className={`py-3 px-3.5 sm:px-4 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{editingItem ? 'Chỉnh sửa bài' : 'Tạo bài mới'}</span>
          </button>

          {/* Tab 4: Classes */}
          <button
            id="tab-btn-classes"
            type="button"
            onClick={() => {
              setEditingItem(null);
              setActiveTab('classes');
            }}
            className={`py-3 px-3.5 sm:px-4 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'classes'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Lớp học của tôi ({classCount})</span>
          </button>

          {/* Tab 5: History */}
          <button
            id="tab-btn-history"
            type="button"
            onClick={() => {
              setEditingItem(null);
              setActiveTab('history');
            }}
            className={`py-3 px-3.5 sm:px-4 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Lịch sử giao bài ({historyCount})</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {/* Tab 1: Daily Schedule Mapping (📅 Lịch giao bài) */}
        {activeTab === 'schedule' && (
          <DailyScheduleTab
            onOpenDailyDispatch={() => setIsDailyDispatchOpen(true)}
            onPreviewExercise={onPreviewExercise}
            onOpenCreateNew={handleOpenCreateNew}
            onNavigateToClasses={() => setActiveTab('classes')}
          />
        )}

        {/* Tab 2: Dictation Library */}
        {activeTab === 'library' && (
          <DictationLibraryTab
            onOpenCreateNew={handleOpenCreateNew}
            onEditExercise={handleEditExercise}
            onPreviewExercise={onPreviewExercise}
            onGenerateHomework={handleOpenHomeworkForSavedItem}
          />
        )}

        {/* Tab 3: Create / Edit Dictation */}
        {activeTab === 'create' && (
          <TeacherCreateView
            onBackToHome={() => setActiveTab('library')}
            onGenerateShareLink={onGenerateShareLink}
            onOpenHomeworkModal={handleOpenHomeworkFromCreate}
            onSavedToLibrary={handleSavedToLibrary}
            editingItem={editingItem}
            onCancelEdit={() => {
              setEditingItem(null);
              setActiveTab('library');
            }}
          />
        )}

        {/* Tab 4: Classes Management */}
        {activeTab === 'classes' && <ClassManagementTab />}

        {/* Tab 5: Homework History */}
        {activeTab === 'history' && (
          <HomeworkHistoryTab onPreviewUrl={(url) => window.open(url, '_blank')} />
        )}
      </main>

      {/* MODAL 1: Daily Homework Dispatch for all assigned classes */}
      {isDailyDispatchOpen && (
        <DailyHomeworkModal
          onClose={() => {
            setIsDailyDispatchOpen(false);
            refreshCounts();
          }}
          onPreviewExercise={onPreviewExercise}
        />
      )}

      {/* MODAL 2: Homework Generator for single exercise */}
      {homeworkModalData && (
        <HomeworkGenerateModal
          exercise={homeworkModalData.exercise}
          classLevel={homeworkModalData.classLevel}
          topic={homeworkModalData.topic}
          onClose={() => {
            setHomeworkModalData(null);
            refreshCounts();
          }}
          onPreview={onPreviewExercise}
        />
      )}
    </div>
  );
};
