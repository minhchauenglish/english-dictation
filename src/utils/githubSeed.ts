const GITHUB_SEED_VERSION = 'backup-2026-09-22-17-03-v1';
const SEED_URL = `${import.meta.env.BASE_URL}library-seed.json`;

const STORAGE_KEYS = {
  SAVED_DICTATIONS: 'eng_dict_saved_library_v1',
  TEACHER_CLASSES: 'eng_dict_teacher_classes_v1',
  HOMEWORK_HISTORY: 'eng_dict_homework_history_v1',
  CLASS_ASSIGNMENTS: 'eng_dict_class_assignments_v1',
  SEED_VERSION: 'eng_dict_github_seed_version_v1',
};

type BackupPayload = {
  lessons?: unknown[];
  classes?: unknown[];
  assignments?: Record<string, string>;
  homeworkHistory?: unknown[];
};

/**
 * On GitHub Pages only, load the teacher's exported backup once into the
 * browser's localStorage. This is deliberately one-time and does not affect
 * the existing AI Studio environment.
 */
export async function ensureGithubSeeded(): Promise<void> {
  if (typeof window === 'undefined') return;

  const isGithubPages =
    window.location.hostname.endsWith('.github.io') ||
    window.location.hostname === 'github.io';

  if (!isGithubPages) return;

  try {
    if (localStorage.getItem(STORAGE_KEYS.SEED_VERSION) === GITHUB_SEED_VERSION) {
      return;
    }

    const response = await fetch(SEED_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.warn('[GitHub seed] Could not load seed file:', response.status);
      return;
    }

    const backup = (await response.json()) as BackupPayload;

    if (!Array.isArray(backup.lessons) || backup.lessons.length === 0) {
      console.warn('[GitHub seed] No lessons found in backup.');
      return;
    }

    // Intentionally replace the temporary GitHub-local library once so the
    // deployed teacher environment starts from the exported backup.
    localStorage.setItem(
      STORAGE_KEYS.SAVED_DICTATIONS,
      JSON.stringify(backup.lessons),
    );

    if (Array.isArray(backup.classes) && backup.classes.length > 0) {
      localStorage.setItem(
        STORAGE_KEYS.TEACHER_CLASSES,
        JSON.stringify(backup.classes),
      );
    }

    if (backup.assignments && typeof backup.assignments === 'object') {
      localStorage.setItem(
        STORAGE_KEYS.CLASS_ASSIGNMENTS,
        JSON.stringify(backup.assignments),
      );
    }

    if (Array.isArray(backup.homeworkHistory)) {
      localStorage.setItem(
        STORAGE_KEYS.HOMEWORK_HISTORY,
        JSON.stringify(backup.homeworkHistory),
      );
    }

    localStorage.setItem(STORAGE_KEYS.SEED_VERSION, GITHUB_SEED_VERSION);

    console.info(
      `[GitHub seed] Loaded ${backup.lessons.length} lessons from teacher backup.`,
    );
  } catch (error) {
    console.warn('[GitHub seed] Seed loading failed:', error);
  }
}
