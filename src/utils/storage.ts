import {
  SavedDictationItem,
  TeacherClass,
  HomeworkHistoryItem,
  DictationExercise,
} from '../types';

const STORAGE_KEYS = {
  STUDENT_NAME: 'eng_dict_student_name',
  TEACHER_DRAFT: 'eng_dict_teacher_draft',
  SAVED_DICTATIONS: 'eng_dict_saved_library_v1',
  TEACHER_CLASSES: 'eng_dict_teacher_classes_v1',
  HOMEWORK_HISTORY: 'eng_dict_homework_history_v1',
  CLASS_ASSIGNMENTS: 'eng_dict_class_assignments_v1',
};

export interface TeacherDraft {
  title: string;
  classLevel?: string;
  topic?: string;
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

const DEFAULT_CLASSES: TeacherClass[] = [
  { id: 'c1', name: 'KID1A', gradeLevel: 'KID 1', studentCount: 18, createdAt: new Date().toISOString() },
  { id: 'c2', name: 'KID1B', gradeLevel: 'KID 1', studentCount: 16, createdAt: new Date().toISOString() },
  { id: 'c3', name: 'KID2A', gradeLevel: 'KID 2', studentCount: 20, createdAt: new Date().toISOString() },
  { id: 'c4', name: 'KID2B', gradeLevel: 'KID 2', studentCount: 19, createdAt: new Date().toISOString() },
  { id: 'c5', name: 'Grade 3A', gradeLevel: 'Grade 3', studentCount: 24, createdAt: new Date().toISOString() },
  { id: 'c6', name: 'Grade 3B', gradeLevel: 'Grade 3', studentCount: 22, createdAt: new Date().toISOString() },
  { id: 'c7', name: 'Grade 4A', gradeLevel: 'Grade 4', studentCount: 25, createdAt: new Date().toISOString() },
  { id: 'c8', name: 'Grade 4B', gradeLevel: 'Grade 4', studentCount: 23, createdAt: new Date().toISOString() },
  { id: 'c9', name: 'Grade 5A', gradeLevel: 'Grade 5', studentCount: 26, createdAt: new Date().toISOString() },
  { id: 'c10', name: 'Grade 5B', gradeLevel: 'Grade 5', studentCount: 24, createdAt: new Date().toISOString() },
  { id: 'c11', name: 'Teen1', gradeLevel: 'Secondary', studentCount: 18, createdAt: new Date().toISOString() },
  { id: 'c12', name: 'Teen2', gradeLevel: 'Secondary', studentCount: 15, createdAt: new Date().toISOString() },
];

const DEFAULT_STARTER_EXERCISES: SavedDictationItem[] = [
  {
    id: 'starter-1',
    title: 'Unit 2: Daily Routines',
    classLevel: 'Grade 3A',
    topic: 'Daily Life & Morning Routine',
    passage:
      "I get up at six o'clock every morning.\nI have breakfast with my family.\nI go to school by bus.\nI like English very much.\nI do my homework in the evening.",
    exercise: {
      title: 'Unit 2: Daily Routines',
      sentences: [
        { id: 's1', order: 1, text: "I get up at six o'clock every morning." },
        { id: 's2', order: 2, text: 'I have breakfast with my family.' },
        { id: 's3', order: 3, text: 'I go to school by bus.' },
        { id: 's4', order: 4, text: 'I like English very much.' },
        { id: 's5', order: 5, text: 'I do my homework in the evening.' },
      ],
      voiceMode: 'NATURAL',
      voiceAccent: 'US',
      playbackSpeed: 0.95,
      listenLimit: 3,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  },
  {
    id: 'starter-2',
    title: 'Unit 5: Animals & Pets',
    classLevel: 'KID2A',
    topic: 'Cute Animals & Pets',
    passage:
      'I have a little brown dog.\nHe likes running in the green garden.\nWe play with a small yellow ball.\nMy dog sleeps under the chair.',
    exercise: {
      title: 'Unit 5: Animals & Pets',
      sentences: [
        { id: 'p1', order: 1, text: 'I have a little brown dog.' },
        { id: 'p2', order: 2, text: 'He likes running in the green garden.' },
        { id: 'p3', order: 3, text: 'We play with a small yellow ball.' },
        { id: 'p4', order: 4, text: 'My dog sleeps under the chair.' },
      ],
      voiceMode: 'UK',
      voiceAccent: 'UK',
      playbackSpeed: 0.95,
      listenLimit: 3,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
  },
  {
    id: 'starter-3',
    title: 'Unit 1: Back to School',
    classLevel: 'Grade 4A',
    topic: 'Classroom & School Life',
    passage:
      'This is my new English classroom.\nThere are twenty desks and chairs.\nOur teacher writes on the white board.\nOpen your English books to page ten.',
    exercise: {
      title: 'Unit 1: Back to School',
      sentences: [
        { id: 'c1', order: 1, text: 'This is my new English classroom.' },
        { id: 'c2', order: 2, text: 'There are twenty desks and chairs.' },
        { id: 'c3', order: 3, text: 'Our teacher writes on the white board.' },
        { id: 'c4', order: 4, text: 'Open your English books to page ten.' },
      ],
      voiceMode: 'NATURAL',
      voiceAccent: 'US',
      playbackSpeed: 0.95,
      listenLimit: 3,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'starter-4',
    title: 'Unit 3: Colours & Shapes',
    classLevel: 'KID1A',
    topic: 'Bright Colours and Fun Shapes',
    passage:
      'I see a big red apple.\nThe sky is sunny and blue.\nShe has a bright yellow hat.\nLook at the green tree.',
    exercise: {
      title: 'Unit 3: Colours & Shapes',
      sentences: [
        { id: 'col1', order: 1, text: 'I see a big red apple.' },
        { id: 'col2', order: 2, text: 'The sky is sunny and blue.' },
        { id: 'col3', order: 3, text: 'She has a bright yellow hat.' },
        { id: 'col4', order: 4, text: 'Look at the green tree.' },
      ],
      voiceMode: 'NATURAL',
      voiceAccent: 'US',
      playbackSpeed: 0.9,
      listenLimit: 3,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 'starter-5',
    title: 'Unit 4: My Lovely Family',
    classLevel: 'Grade 3B',
    topic: 'Family Members & Home',
    passage:
      'There are four people in my family.\nMy father is a kind doctor.\nMy mother cooks delicious dinner.\nI love my family very much.',
    exercise: {
      title: 'Unit 4: My Lovely Family',
      sentences: [
        { id: 'fam1', order: 1, text: 'There are four people in my family.' },
        { id: 'fam2', order: 2, text: 'My father is a kind doctor.' },
        { id: 'fam3', order: 3, text: 'My mother cooks delicious dinner.' },
        { id: 'fam4', order: 4, text: 'I love my family very much.' },
      ],
      voiceMode: 'NATURAL',
      voiceAccent: 'US',
      playbackSpeed: 0.95,
      listenLimit: 3,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'starter-6',
    title: 'Unit 6: Food & Favorite Drinks',
    classLevel: 'Grade 5A',
    topic: 'Delicious Meals & Nutrition',
    passage:
      'I like eating fresh bread and butter in the morning.\nMy favorite fruit is sweet watermelon.\nWe always drink plenty of fresh water every day.\nHealthy food gives us good energy for sports.',
    exercise: {
      title: 'Unit 6: Food & Favorite Drinks',
      sentences: [
        { id: 'fd1', order: 1, text: 'I like eating fresh bread and butter in the morning.' },
        { id: 'fd2', order: 2, text: 'My favorite fruit is sweet watermelon.' },
        { id: 'fd3', order: 3, text: 'We always drink plenty of fresh water every day.' },
        { id: 'fd4', order: 4, text: 'Healthy food gives us good energy for sports.' },
      ],
      voiceMode: 'NATURAL',
      voiceAccent: 'US',
      playbackSpeed: 1.0,
      listenLimit: 3,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_INITIAL_ASSIGNMENTS: Record<string, string> = {
  c1: 'starter-4', // KID1A -> Unit 3 Colours
  c2: 'starter-4', // KID1B -> Unit 3 Colours
  c3: 'starter-2', // KID2A -> Unit 5 Animals
  c4: 'starter-2', // KID2B -> Unit 5 Animals
  c5: 'starter-1', // Grade 3A -> Unit 2 Daily Routines
  c6: 'starter-5', // Grade 3B -> Unit 4 Family
  c7: 'starter-3', // Grade 4A -> Unit 1 Back to School
  c8: 'starter-3', // Grade 4B -> Unit 1 Back to School
  c9: 'starter-6', // Grade 5A -> Unit 6 Food & Drinks
  c10: 'starter-6', // Grade 5B -> Unit 6 Food & Drinks
  c11: 'starter-1', // Teen1 -> Unit 2 Daily Routines
  c12: 'starter-6', // Teen2 -> Unit 6 Food & Drinks
};

class ClientStorage {
  // Student Name
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

  // Teacher Draft
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

  // Dictation Library
  public getSavedDictations(): SavedDictationItem[] {
    if (typeof window === 'undefined') return DEFAULT_STARTER_EXERCISES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_DICTATIONS);
      if (!data) {
        // Seed default starter exercises if none exist yet
        this.saveAllDictations(DEFAULT_STARTER_EXERCISES);
        return DEFAULT_STARTER_EXERCISES;
      }
      const parsed: SavedDictationItem[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : DEFAULT_STARTER_EXERCISES;
    } catch {
      return DEFAULT_STARTER_EXERCISES;
    }
  }

  public saveDictation(item: Omit<SavedDictationItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SavedDictationItem {
    const list = this.getSavedDictations();
    const now = new Date().toISOString();
    const existingIndex = item.id ? list.findIndex((x) => x.id === item.id) : -1;

    let savedItem: SavedDictationItem;

    if (existingIndex >= 0) {
      savedItem = {
        ...list[existingIndex],
        ...item,
        id: list[existingIndex].id,
        updatedAt: now,
      };
      list[existingIndex] = savedItem;
    } else {
      savedItem = {
        ...item,
        id: item.id || `dict_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      list.unshift(savedItem);
    }

    this.saveAllDictations(list);
    return savedItem;
  }

  public deleteDictation(id: string): void {
    const list = this.getSavedDictations().filter((x) => x.id !== id);
    this.saveAllDictations(list);
  }

  private saveAllDictations(list: SavedDictationItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_DICTATIONS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not persist dictation library', e);
    }
  }

  // Teacher Classes
  public getTeacherClasses(): TeacherClass[] {
    if (typeof window === 'undefined') return DEFAULT_CLASSES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEACHER_CLASSES);
      if (!data) {
        this.saveAllClasses(DEFAULT_CLASSES);
        return DEFAULT_CLASSES;
      }
      const parsed: TeacherClass[] = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CLASSES;
    } catch {
      return DEFAULT_CLASSES;
    }
  }

  public addClass(name: string): TeacherClass | null {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const list = this.getTeacherClasses();
    if (list.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return null; // Already exists
    }

    const newClass: TeacherClass = {
      id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
    };

    list.push(newClass);
    this.saveAllClasses(list);
    return newClass;
  }

  public renameClass(id: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const list = this.getTeacherClasses();
    const target = list.find((c) => c.id === id);
    if (!target) return false;

    target.name = trimmed;
    this.saveAllClasses(list);
    return true;
  }

  public deleteClass(id: string): void {
    const list = this.getTeacherClasses().filter((c) => c.id !== id);
    this.saveAllClasses(list);
  }

  private saveAllClasses(list: TeacherClass[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.TEACHER_CLASSES, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not persist teacher classes', e);
    }
  }

  // Teacher Class Assignment Mapping (📅 Lịch giao bài theo lớp)
  public getClassAssignments(): Record<string, string> {
    if (typeof window === 'undefined') return DEFAULT_INITIAL_ASSIGNMENTS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLASS_ASSIGNMENTS);
      if (!data) {
        this.saveAllClassAssignments(DEFAULT_INITIAL_ASSIGNMENTS);
        return DEFAULT_INITIAL_ASSIGNMENTS;
      }
      const parsed = JSON.parse(data);
      return typeof parsed === 'object' && parsed !== null ? parsed : DEFAULT_INITIAL_ASSIGNMENTS;
    } catch {
      return DEFAULT_INITIAL_ASSIGNMENTS;
    }
  }

  public setClassAssignment(classId: string, dictationId: string | null): void {
    const current = this.getClassAssignments();
    if (dictationId) {
      current[classId] = dictationId;
    } else {
      delete current[classId];
    }
    this.saveAllClassAssignments(current);
  }

  public saveAllClassAssignments(mapping: Record<string, string>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.CLASS_ASSIGNMENTS, JSON.stringify(mapping));
    } catch (e) {
      console.warn('Could not persist class assignments', e);
    }
  }

  public resetClassAssignmentsToDefaults(): Record<string, string> {
    this.saveAllClassAssignments(DEFAULT_INITIAL_ASSIGNMENTS);
    return DEFAULT_INITIAL_ASSIGNMENTS;
  }

  // Homework History
  public getHomeworkHistory(): HomeworkHistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HOMEWORK_HISTORY);
      if (!data) return [];
      const parsed: HomeworkHistoryItem[] = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Sort newest first
      return parsed.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch {
      return [];
    }
  }

  public addHomeworkHistoryItems(items: HomeworkHistoryItem[]): void {
    if (!items || items.length === 0) return;
    const history = this.getHomeworkHistory();
    const itemsWithStatus = items.map((it) => ({
      ...it,
      status: it.status || 'Đã giao',
    }));
    const updated = [...itemsWithStatus, ...history].slice(0, 300); // keep up to 300 latest assignments
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.HOMEWORK_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist homework history', e);
    }
  }

  public deleteHomeworkHistoryItem(id: string): void {
    const history = this.getHomeworkHistory().filter((x) => x.id !== id);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.HOMEWORK_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('Could not delete history item', e);
    }
  }

  public clearHomeworkHistory(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.HOMEWORK_HISTORY);
    } catch {}
  }
}

export const clientStorage = new ClientStorage();
