import React, { useState, useEffect, useCallback } from 'react';
import { DictationExercise, SentenceSubmissionResult } from './types';
import { decodeExercise, getEncodedExerciseFromLocation } from './utils/codec';
import { HomeView } from './components/HomeView';
import { TeacherDashboardView } from './components/TeacherDashboard/TeacherDashboardView';
import { ShareModal } from './components/ShareModal';
import { DirectLinkModal } from './components/DirectLinkModal';
import { StudentStartView } from './components/StudentStartView';
import { StudentPracticeView } from './components/StudentPracticeView';
import { StudentResultView } from './components/StudentResultView';

type AppView =
  | 'home'
  | 'teacher_dashboard'
  | 'student_start'
  | 'student_practice'
  | 'student_result';

export function App() {
  const [view, setView] = useState<AppView>('home');
  const [activeExercise, setActiveExercise] = useState<DictationExercise | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [completedResults, setCompletedResults] = useState<SentenceSubmissionResult[]>([]);
  const [isRemediationRound, setIsRemediationRound] = useState<boolean>(false);

  // Modals
  const [shareModalExercise, setShareModalExercise] = useState<DictationExercise | null>(null);
  const [isDirectLinkModalOpen, setIsDirectLinkModalOpen] = useState<boolean>(false);

  // Check URL hash on initial mount and hash changes
  const checkHashForExercise = useCallback(() => {
    const encoded = getEncodedExerciseFromLocation();
    if (encoded) {
      const decoded = decodeExercise(encoded);
      if (decoded && decoded.sentences.length > 0) {
        setActiveExercise(decoded);
        setIsRemediationRound(false);
        setView('student_start');
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    checkHashForExercise();

    const handleHashChange = () => {
      checkHashForExercise();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [checkHashForExercise]);

  // Handler: Open Teacher Dashboard
  const handleOpenTeacherDashboard = () => {
    setView('teacher_dashboard');
  };

  // Handler: Generate link from teacher view (legacy direct share / QR)
  const handleGenerateShareLink = (exercise: DictationExercise) => {
    setShareModalExercise(exercise);
  };

  // Handler: Student practice initiation from sample, library or direct link
  const handleStartPracticeWithExercise = (exercise: DictationExercise) => {
    setActiveExercise(exercise);
    setIsRemediationRound(false);
    setView('student_start');
  };

  // Handler: Student entered name and clicked "BẮT ĐẦU"
  const handleStudentStartPractice = (enteredName: string) => {
    setStudentName(enteredName);
    setView('student_practice');
  };

  // Handler: Student finished all sentences
  const handleFinishAllSentences = (results: SentenceSubmissionResult[]) => {
    setCompletedResults(results);
    setView('student_result');
  };

  // Handler: Retry incorrect sentences
  const handleRetryIncorrect = (incorrectResults: SentenceSubmissionResult[]) => {
    if (!activeExercise) return;

    // Filter exercise to only include sentences that were incorrect
    const incorrectOrders = new Set(incorrectResults.map((r) => r.sentenceOrder));
    const retriedSentences = activeExercise.sentences.filter((s) =>
      incorrectOrders.has(s.order)
    );

    const retryExercise: DictationExercise = {
      ...activeExercise,
      title: `${activeExercise.title} (Luyện câu sai)`,
      sentences: retriedSentences.map((s, i) => ({
        ...s,
        order: i + 1,
      })),
    };

    setIsRemediationRound(true);
    setActiveExercise(retryExercise);
    setView('student_practice');
  };

  // Handler: Restart entire exercise
  const handleRestartAll = () => {
    setIsRemediationRound(false);
    setView('student_practice');
  };

  // Handler: Navigate back to Home
  const handleBackToHome = () => {
    window.location.hash = '';
    setActiveExercise(null);
    setIsRemediationRound(false);
    setView('home');
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans antialiased select-none sm:select-auto">
      {/* 1. HOMEPAGE */}
      {view === 'home' && (
        <HomeView
          onStartCreate={handleOpenTeacherDashboard}
          onOpenTeacherDashboard={handleOpenTeacherDashboard}
          onOpenPracticeWithExercise={handleStartPracticeWithExercise}
          onOpenLinkModal={() => setIsDirectLinkModalOpen(true)}
        />
      )}

      {/* 2. TEACHER DASHBOARD (Library, Create, Classes, History) */}
      {view === 'teacher_dashboard' && (
        <TeacherDashboardView
          onBackToHome={handleBackToHome}
          onPreviewExercise={handleStartPracticeWithExercise}
          onGenerateShareLink={handleGenerateShareLink}
        />
      )}

      {/* 3. STUDENT ENTRY / START SCREEN */}
      {view === 'student_start' && activeExercise && (
        <StudentStartView
          exercise={activeExercise}
          onStart={handleStudentStartPractice}
          onBackToHome={handleBackToHome}
        />
      )}

      {/* 4. STUDENT ACTIVE DICTATION PRACTICE */}
      {view === 'student_practice' && activeExercise && (
        <StudentPracticeView
          exercise={activeExercise}
          studentName={studentName}
          onFinishAll={handleFinishAllSentences}
          onExit={handleBackToHome}
        />
      )}

      {/* 5. FINAL RESULT SCREEN */}
      {view === 'student_result' && activeExercise && (
        <StudentResultView
          exercise={activeExercise}
          studentName={studentName}
          sentenceResults={completedResults}
          isRemediationRound={isRemediationRound}
          onRetryIncorrect={handleRetryIncorrect}
          onRestartAll={handleRestartAll}
          onBackToHome={handleBackToHome}
        />
      )}

      {/* MODAL: SHARE EXERCISE (Local URL hash & Local QR code) */}
      {shareModalExercise && (
        <ShareModal
          exercise={shareModalExercise}
          onClose={() => setShareModalExercise(null)}
          onPreviewPractice={(ex) => {
            setShareModalExercise(null);
            handleStartPracticeWithExercise(ex);
          }}
        />
      )}

      {/* MODAL: DIRECT LINK / SAMPLE PICKER */}
      {isDirectLinkModalOpen && (
        <DirectLinkModal
          isOpen={isDirectLinkModalOpen}
          onClose={() => setIsDirectLinkModalOpen(false)}
          onSelectExercise={handleStartPracticeWithExercise}
        />
      )}
    </div>
  );
}

export default App;
