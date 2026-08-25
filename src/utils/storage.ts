/**
 * Local storage utility strictly for client-side persistence of:
 * - student's entered name
 * - teacher's unfinished draft
 */

const STORAGE_KEYS = {
  STUDENT_NAME: 'eng_dict_student_name',
  TEACHER_DRAFT: 'eng_dict_teacher_draft',
};

export interface TeacherDraft {
  title: string;
  passage: string;
  exerciseMode?: 'PRACTICE' | 'TEST';
  voiceMode?: 'NATURAL' | 'US' | 'UK' | 'CUSTOM';
  voiceAccent?: 'US' | 'UK';
  preferredVoiceName?: string;
  preferredVoiceURI?: string;
  preferredLang?: string;
  pitch?: number;
  playbackSpeed: number;
  listenLimit: number;
  checkMode: 'EASY' | 'STRICT';
}

class ClientStorage {
  public getStudentName(): string {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(STORAGE_KEYS.STUDENT_NAME) || '';
    } catch {
      return '';
    }
  }

  public setStudentName(name: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT_NAME, name.trim());
    } catch (e) {
      console.warn('Could not save student name', e);
    }
  }

  public getTeacherDraft(): TeacherDraft | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEACHER_DRAFT);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public setTeacherDraft(draft: TeacherDraft): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.TEACHER_DRAFT, JSON.stringify(draft));
    } catch (e) {
      console.warn('Could not save teacher draft', e);
    }
  }

  public clearTeacherDraft(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.TEACHER_DRAFT);
    } catch {}
  }
}

export const clientStorage = new ClientStorage();
