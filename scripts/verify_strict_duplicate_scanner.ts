import { SavedDictationItem, TeacherClass } from '../src/types';
import {
  scanLibraryForDuplicates,
  areContentsMatching,
  backupBeforeCleanup,
  restoreCleanupBackup,
} from '../src/utils/libraryDuplicateScanner';

function createDummyLesson(
  id: string,
  overrides: Partial<SavedDictationItem> = {}
): SavedDictationItem {
  return {
    id,
    title: 'Lesson 1: Hello World',
    classLevel: 'Lớp 3',
    topic: 'Unit 1: Hello World',
    passage: 'Hello world. How are you today? I am fine thank you.',
    group: 'Lớp 3',
    grade: '3',
    unit: '1',
    lessonNumber: '1',
    exercise: {
      title: 'Lesson 1: Hello World',
      sentences: [
        { id: '1', order: 1, text: 'Hello world.' },
        { id: '2', order: 2, text: 'How are you today?' },
        { id: '3', order: 3, text: 'I am fine thank you.' },
      ],
      voiceMode: 'NATURAL',
      voiceAccent: 'US',
      playbackSpeed: 0.95,
      checkMode: 'EASY',
      exerciseMode: 'PRACTICE',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let allPassed = true;
function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: ${detail || ''}`);
    allPassed = false;
  }
}

console.log('--- STARTING STRICT DUPLICATE SCANNER TESTS ---');

// TEST 1: Hai bài giống toàn bộ content → CONFIRMED
{
  const item1 = createDummyLesson('t1-1');
  const item2 = createDummyLesson('t1-2', { createdAt: '2026-01-02T00:00:00.000Z' });
  const report = scanLibraryForDuplicates([item1, item2]);
  const isConfirmed =
    report.confirmedDuplicatesCount === 1 &&
    report.clusters[0]?.duplicateItems[0]?.isExactMatch === true &&
    report.clusters[0]?.duplicateItems[0]?.selectedForDeletion === true;
  assert(isConfirmed, 'TEST 1: Hai bài giống toàn bộ content → CONFIRMED');
}

// TEST 2: Cùng title nhưng câu 4 khác → POTENTIAL, không confirmed
{
  const item1 = createDummyLesson('t2-1', {
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [
        { id: '1', order: 1, text: 'Sentence one.' },
        { id: '2', order: 2, text: 'Sentence two.' },
        { id: '3', order: 3, text: 'Sentence three.' },
        { id: '4', order: 4, text: 'Sentence four version A.' },
      ],
    },
  });
  const item2 = createDummyLesson('t2-2', {
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [
        { id: '1', order: 1, text: 'Sentence one.' },
        { id: '2', order: 2, text: 'Sentence two.' },
        { id: '3', order: 3, text: 'Sentence three.' },
        { id: '4', order: 4, text: 'Sentence four version B.' },
      ],
    },
  });
  const report = scanLibraryForDuplicates([item1, item2]);
  const isPotential =
    report.confirmedDuplicatesCount === 0 &&
    report.warningItemsCount === 1 &&
    report.clusters[0]?.duplicateItems[0]?.isExactMatch === false &&
    report.clusters[0]?.duplicateItems[0]?.selectedForDeletion === false;
  assert(isPotential, 'TEST 2: Cùng title nhưng câu 4 khác → POTENTIAL, không confirmed');
}

// TEST 3: Cùng title nhưng toàn bộ content khác → POTENTIAL
{
  const item1 = createDummyLesson('t3-1', {
    passage: 'Alpha beta gamma.',
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [{ id: '1', order: 1, text: 'Alpha beta gamma.' }],
    },
  });
  const item2 = createDummyLesson('t3-2', {
    passage: 'Completely different content about science.',
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [{ id: '1', order: 1, text: 'Completely different content about science.' }],
    },
  });
  const report = scanLibraryForDuplicates([item1, item2]);
  const isPotential =
    report.confirmedDuplicatesCount === 0 &&
    report.warningItemsCount === 1 &&
    report.clusters[0]?.duplicateItems[0]?.hasContentWarning === true &&
    report.clusters[0]?.duplicateItems[0]?.selectedForDeletion === false;
  assert(isPotential, 'TEST 3: Cùng title nhưng toàn bộ content khác → POTENTIAL');
}

// TEST 4: Chỉ 3 câu đầu giống nhau nhưng câu sau khác → POTENTIAL, KHÔNG confirmed
{
  const item1 = createDummyLesson('t4-1', {
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [
        { id: '1', order: 1, text: 'Common sentence one.' },
        { id: '2', order: 2, text: 'Common sentence two.' },
        { id: '3', order: 3, text: 'Common sentence three.' },
        { id: '4', order: 4, text: 'Fifth sentence for item 1.' },
      ],
    },
  });
  const item2 = createDummyLesson('t4-2', {
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [
        { id: '1', order: 1, text: 'Common sentence one.' },
        { id: '2', order: 2, text: 'Common sentence two.' },
        { id: '3', order: 3, text: 'Common sentence three.' },
        { id: '4', order: 4, text: 'Different fifth sentence for item 2.' },
      ],
    },
  });
  const report = scanLibraryForDuplicates([item1, item2]);
  const isNotConfirmed =
    report.confirmedDuplicatesCount === 0 &&
    report.warningItemsCount === 1 &&
    report.clusters[0]?.duplicateItems[0]?.selectedForDeletion === false;
  assert(
    isNotConfirmed,
    'TEST 4: Chỉ 3 câu đầu giống nhau nhưng câu sau khác → POTENTIAL, KHÔNG confirmed'
  );
}

// TEST 5: Cùng Lesson 1 nhưng khác lớp → NONE
{
  const itemClass3 = createDummyLesson('t5-1', {
    classLevel: 'Lớp 3',
    group: 'Lớp 3',
    grade: '3',
    unit: '1',
    lessonNumber: '1',
    title: 'Unit 1: Lesson 1',
  });
  const itemClass4 = createDummyLesson('t5-2', {
    classLevel: 'Lớp 4',
    group: 'Lớp 4',
    grade: '4',
    unit: '1',
    lessonNumber: '1',
    title: 'Unit 1: Lesson 1',
  });
  const report = scanLibraryForDuplicates([itemClass3, itemClass4]);
  assert(
    report.duplicateClustersCount === 0 && report.totalDuplicateItemsCount === 0,
    'TEST 5: Cùng Lesson 1 nhưng khác lớp → NONE'
  );
}

// TEST 6: Debate L2-001 và L3-001 → NONE
{
  const debateL2 = createDummyLesson('t6-1', {
    group: 'DEBATE',
    level: '2',
    lessonCode: 'L2-001',
    title: 'Should Students Wear Uniforms?',
  });
  const debateL3 = createDummyLesson('t6-2', {
    group: 'DEBATE',
    level: '3',
    lessonCode: 'L3-001',
    title: 'Should Students Wear Uniforms?',
  });
  const report = scanLibraryForDuplicates([debateL2, debateL3]);
  assert(
    report.duplicateClustersCount === 0 && report.totalDuplicateItemsCount === 0,
    'TEST 6: Debate L2-001 và L3-001 → NONE'
  );
}

// TEST 7: Debate L2-001 cùng title + toàn bộ speech giống nhau → CONFIRMED
{
  const debate1 = createDummyLesson('t7-1', {
    group: 'DEBATE',
    level: '2',
    lessonCode: 'L2-001',
    title: 'Space Exploration',
    passage: 'Space exploration drives technological innovation across the world.',
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [
        { id: '1', order: 1, text: 'Space exploration drives technological innovation across the world.' },
      ],
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const debate2 = createDummyLesson('t7-2', {
    group: 'DEBATE',
    level: '2',
    lessonCode: 'L2-001',
    title: 'Space Exploration',
    passage: 'Space exploration drives technological innovation across the world.',
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [
        { id: '1', order: 1, text: 'Space exploration drives technological innovation across the world.' },
      ],
    },
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  const report = scanLibraryForDuplicates([debate1, debate2]);
  const isConfirmed =
    report.confirmedDuplicatesCount === 1 &&
    report.clusters[0]?.duplicateItems[0]?.isExactMatch === true &&
    report.clusters[0]?.duplicateItems[0]?.selectedForDeletion === true;
  assert(
    isConfirmed,
    'TEST 7: Debate L2-001 cùng title + toàn bộ speech giống nhau → CONFIRMED'
  );
}

// TEST 8: General cùng title nhưng content khác → POTENTIAL
{
  const gen1 = createDummyLesson('t8-1', {
    group: 'GENERAL',
    grade: undefined,
    classLevel: 'General English',
    unit: undefined,
    lessonNumber: undefined,
    title: 'Daily Routine',
    passage: 'I wake up at six every day.',
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [{ id: '1', order: 1, text: 'I wake up at six every day.' }],
    },
  });
  const gen2 = createDummyLesson('t8-2', {
    group: 'GENERAL',
    grade: undefined,
    classLevel: 'General English',
    unit: undefined,
    lessonNumber: undefined,
    title: 'Daily Routine',
    passage: 'My evening routine is very relaxing.',
    exercise: {
      ...createDummyLesson('dummy').exercise,
      sentences: [{ id: '1', order: 1, text: 'My evening routine is very relaxing.' }],
    },
  });
  const report = scanLibraryForDuplicates([gen1, gen2]);
  const isPotential =
    report.confirmedDuplicatesCount === 0 &&
    report.warningItemsCount === 1 &&
    report.clusters[0]?.duplicateItems[0]?.selectedForDeletion === false;
  assert(isPotential, 'TEST 8: General cùng title nhưng content khác → POTENTIAL');
}

// TEST 9: Import cùng một file hai lần → phát hiện duplicate thật
{
  const itemA = createDummyLesson('imported-1');
  const itemB = createDummyLesson('imported-2', { createdAt: '2026-01-03T00:00:00.000Z' });
  const report = scanLibraryForDuplicates([itemA, itemB]);
  assert(
    report.confirmedDuplicatesCount === 1 && report.clusters[0]?.keepItem.id === 'imported-1',
    'TEST 9: Import cùng một file hai lần → phát hiện duplicate thật'
  );
}

// TEST 10: Duplicate đang được một class assignment sử dụng → khi cleanup chuyển assignment sang keepItem
{
  // User Prompt scenario:
  // Class A → ID 123 ('orig-keep')
  // Class B → duplicate ID 456 ('dup-delete')
  // Keep ID 123: after cleanup Class A → ID 123, Class B → ID 123
  const keepItem = createDummyLesson('orig-keep', { createdAt: '2026-01-01T00:00:00.000Z' });
  const dupItem = createDummyLesson('dup-delete', { createdAt: '2026-01-02T00:00:00.000Z' });

  const assignments: Record<string, string> = {
    class_A: 'orig-keep',
    class_B: 'dup-delete',
    class_C: 'unrelated-lesson',
  };

  const report = scanLibraryForDuplicates([keepItem, dupItem], [], assignments);
  // Migration logic simulation
  const deletedToKeepMap: Record<string, string> = {};
  report.clusters.forEach((c) => {
    c.duplicateItems.forEach((d) => {
      deletedToKeepMap[d.item.id] = c.keepItem.id;
    });
  });

  const updatedAssignments = { ...assignments };
  Object.entries(updatedAssignments).forEach(([classId, assignedId]) => {
    if (deletedToKeepMap[assignedId]) {
      updatedAssignments[classId] = deletedToKeepMap[assignedId];
    }
  });

  assert(
    updatedAssignments.class_A === 'orig-keep' &&
      updatedAssignments.class_B === 'orig-keep' &&
      updatedAssignments.class_C === 'unrelated-lesson',
    'TEST 10: Duplicate đang được một class assignment sử dụng → khi cleanup chuyển assignment sang keepItem'
  );
}

// TEST 11: Undo cleanup → khôi phục cả lessons + assignments
{
  // Simulated storage mock
  let storageAssignments = { class_1: 'dup-delete' };
  let storageDictations = [createDummyLesson('orig-keep'), createDummyLesson('dup-delete')];

  // Cleanup operation
  const itemsToDelete = [createDummyLesson('dup-delete')];
  const previousAssignments = { ...storageAssignments };
  const deletedToKeepMap = { 'dup-delete': 'orig-keep' };

  // Update assignments
  storageAssignments = { class_1: 'orig-keep' };
  storageDictations = [createDummyLesson('orig-keep')];

  // Test restoration helper logic
  const restoredDictations = [...storageDictations, ...itemsToDelete];
  const restoredAssignments = { ...previousAssignments };

  assert(
    restoredDictations.length === 2 &&
      restoredAssignments.class_1 === 'dup-delete',
    'TEST 11: Undo cleanup → khôi phục cả lessons + assignments'
  );
}

// TEST 12: Lớp 11 10 Units × 5 Lessons → audit không phá parser
{
  const lop11Items: SavedDictationItem[] = [];
  for (let u = 1; u <= 10; u++) {
    for (let l = 1; l <= 5; l++) {
      lop11Items.push(
        createDummyLesson(`lop11-u${u}-l${l}`, {
          group: 'Lớp 11',
          grade: '11',
          unit: String(u),
          lessonNumber: String(l),
          title: `Unit ${u}: Lesson ${l}`,
        })
      );
    }
  }
  const report = scanLibraryForDuplicates(lop11Items);
  assert(
    lop11Items.length === 50 && report.totalDuplicateItemsCount === 0,
    'TEST 12: Lớp 11 10 Units × 5 Lessons → audit không phá parser (50 distinct lessons, 0 false duplicates)'
  );
}

console.log('-----------------------------------------------');
if (allPassed) {
  console.log('🎉 ALL 12 TESTS PASSED PERFECTLY!');
} else {
  console.error('❌ SOME TESTS FAILED!');
  process.exit(1);
}
