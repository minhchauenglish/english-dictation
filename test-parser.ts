import fs from 'fs';
import mammothModule from 'mammoth';
import { parseWordContent } from './src/utils/wordParser';
import { SAMPLE_WORD_DOCX_CONTENT } from './src/utils/templateDownloader';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammoth: any = (mammothModule as any)?.default || mammothModule;

async function runTests() {
  console.log('=== TEST 1: Sample Word docx file (English_Dictation_Word_Template.docx) ===');
  const buffer = fs.readFileSync('./public/English_Dictation_Word_Template.docx');
  const extracted = await mammoth.extractRawText({ buffer });
  const result1 = parseWordContent(
    extracted.value,
    'Mau_File_Word_Import_Bai_Hoc_English_Dictation.docx',
    'file_1'
  );

  console.log(`Detected: ${result1.lessons.length} lessons from sample Word file`);
  result1.lessons.forEach((l, idx) => {
    console.log(`  ${idx + 1}. [Lesson ${l.lessonNumber}] ${l.title} (${l.type})`);
  });

  if (result1.lessons.length !== 4) {
    throw new Error(
      `TEST 1 FAILED: Expected 4 lessons, but got ${result1.lessons.length}`
    );
  }

  const expectedTitles = ['HELLO', 'MY FAMILY', 'MY SCHOOL', 'MY PET'];
  result1.lessons.forEach((l, idx) => {
    if (!l.title.includes(expectedTitles[idx])) {
      throw new Error(
        `TEST 1 FAILED: Lesson ${idx + 1} expected title containing "${expectedTitles[idx]}", got "${l.title}"`
      );
    }
  });

  console.log('=== TEST 2: SAMPLE_WORD_DOCX_CONTENT string ===');
  const result2 = parseWordContent(SAMPLE_WORD_DOCX_CONTENT, 'template_text.docx', 'file_2');
  console.log(`Detected: ${result2.lessons.length} lessons from template text`);
  if (result2.lessons.length !== 4) {
    throw new Error(
      `TEST 2 FAILED: Expected 4 lessons, but got ${result2.lessons.length}`
    );
  }

  console.log('=== TEST 3: Edge cases with instruction text at end without header ===');
  const edgeCaseText = `
CLASS: 1A
GRADE: 1

Lesson 1 – HELLO
CONTENT:
hello
hi

Lesson 2 – MY FAMILY
CONTENT:
father
mother

Lesson 3 – MY SCHOOL
CONTENT:
school
teacher

Lesson 4 – MY PET
CONTENT:
dog
cat

LESSON từ/câu đơn giản dùng CONTENT
LESSON và TITLE phải có trong mỗi bài
LESSON phải có nội dung
UNIT và CONTENT có thể dùng thay thế
BÀI học cần có TITLE
`;
  const result3 = parseWordContent(edgeCaseText, 'edge_case.docx', 'file_3');
  console.log(`Detected: ${result3.lessons.length} lessons in edge case text`);
  if (result3.lessons.length !== 4) {
    throw new Error(
      `TEST 3 FAILED: Expected 4 lessons, but got ${result3.lessons.length}`
    );
  }

  console.log('\nALL PARSER TESTS PASSED PERFECTLY!');
  console.log('4 lessons detected from sample Word file');

  console.log('\n=== TEST 4: DUPLICATE DETECTION UNIT TESTS ===');
  const { isDuplicateLesson, findDuplicateInLibrary } = await import('./src/utils/duplicateDetector');

  const mockTeacherClasses = [
    { id: 'c1', name: 'KID1A', gradeLevel: 'KID 1', createdAt: new Date().toISOString() },
    { id: 'c3', name: 'KID2A', gradeLevel: 'KID 2', createdAt: new Date().toISOString() },
    { id: 'c5', name: 'Grade 3A', gradeLevel: 'Grade 3', createdAt: new Date().toISOString() },
  ];

  // Helper to construct mock SavedDictationItem
  const makeExisting = (opts: {
    id: string;
    title: string;
    classLevel: string;
    classIds?: string[];
  }): import('./src/types').SavedDictationItem => ({
    id: opts.id,
    title: opts.title,
    classLevel: opts.classLevel,
    classIds: opts.classIds,
    topic: opts.title,
    passage: 'Sample passage text for testing',
    exercise: {
      title: opts.title,
      sentences: [{ id: 's1', order: 1, text: 'Sample text' }],
      voiceMode: 'NATURAL' as const,
      voiceAccent: 'US' as const,
      playbackSpeed: 1.0,
      listenLimit: 3,
      checkMode: 'EASY' as const,
      exerciseMode: 'PRACTICE' as const,
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // CASE 1:
  // Existing: KID1A / Lesson 4 / MY PET
  // Incoming: KID2A / Lesson 4 / MY FATHER
  // Expected: NOT DUPLICATE
  console.log('\n- Testing Case 1: KID1A / Lesson 4 / MY PET vs incoming KID2A / Lesson 4 / MY FATHER');
  const existing1 = makeExisting({
    id: 'dict_pet_kid1a',
    title: 'Lesson 4: MY PET',
    classLevel: 'KID1A',
    classIds: ['c1'],
  });
  const incoming1 = {
    title: 'Lesson 4 – MY FATHER',
    lessonNumber: '4',
    detectedClass: 'KID2A',
  };
  const isDup1 = isDuplicateLesson(incoming1, existing1, {
    targetClassIds: ['c3'],
    targetClassName: 'KID2A',
    teacherClasses: mockTeacherClasses,
  });
  console.log(`  Result: ${isDup1 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDup1) {
    throw new Error('FAILED: Expected NOT DUPLICATE for KID1A / MY PET vs KID2A / MY FATHER');
  }
  console.log('  ✓ PASSED: Correctly identified as NOT DUPLICATE');

  // CASE 2:
  // Existing: KID2A / Lesson 4 / MY FATHER
  // Incoming: KID2A / Lesson 4 / MY FATHER
  // Expected: DUPLICATE
  console.log('\n- Testing Case 2: KID2A / Lesson 4 / MY FATHER vs incoming KID2A / Lesson 4 / MY FATHER');
  const existing2 = makeExisting({
    id: 'dict_father_kid2a',
    title: 'Lesson 4: MY FATHER',
    classLevel: 'KID2A',
    classIds: ['c3'],
  });
  const incoming2 = {
    title: 'Lesson 4 – MY FATHER',
    lessonNumber: '4',
    detectedClass: 'KID2A',
  };
  const isDup2 = isDuplicateLesson(incoming2, existing2, {
    targetClassIds: ['c3'],
    targetClassName: 'KID2A',
    teacherClasses: mockTeacherClasses,
  });
  console.log(`  Result: ${isDup2 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (!isDup2) {
    throw new Error('FAILED: Expected DUPLICATE for same class KID2A and same title MY FATHER');
  }
  console.log('  ✓ PASSED: Correctly identified as DUPLICATE');

  // CASE 3:
  // Existing: KID2A / Lesson 4 / MY PET
  // Incoming: KID2A / Lesson 4 / MY FATHER
  // (Same class KID2A, same lesson number 4, but DIFFERENT titles: MY PET vs MY FATHER)
  // Expected: NOT DUPLICATE
  console.log('\n- Testing Case 3: KID2A / Lesson 4 / MY PET vs incoming KID2A / Lesson 4 / MY FATHER');
  const existing3 = makeExisting({
    id: 'dict_pet_kid2a',
    title: 'Lesson 4: MY PET',
    classLevel: 'KID2A',
    classIds: ['c3'],
  });
  const incoming3 = {
    title: 'Lesson 4 – MY FATHER',
    lessonNumber: '4',
    detectedClass: 'KID2A',
  };
  const isDup3 = isDuplicateLesson(incoming3, existing3, {
    targetClassIds: ['c3'],
    targetClassName: 'KID2A',
    teacherClasses: mockTeacherClasses,
  });
  console.log(`  Result: ${isDup3 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDup3) {
    throw new Error('FAILED: Same lesson number but different titles in same class must NOT be duplicate!');
  }
  console.log('  ✓ PASSED: Correctly identified as NOT DUPLICATE (different titles)');

  // CASE 4:
  // Existing: KID1A / Lesson 4 / MY FATHER
  // Incoming: KID2A / Lesson 4 / MY FATHER
  // (Different classes: KID1A vs KID2A, even with SAME title "MY FATHER")
  // Expected: NOT DUPLICATE
  console.log('\n- Testing Case 4: KID1A / MY FATHER vs incoming KID2A / MY FATHER');
  const existing4 = makeExisting({
    id: 'dict_father_kid1a',
    title: 'Lesson 4: MY FATHER',
    classLevel: 'KID1A',
    classIds: ['c1'],
  });
  const incoming4 = {
    title: 'Lesson 4 – MY FATHER',
    lessonNumber: '4',
    detectedClass: 'KID2A',
  };
  const isDup4 = isDuplicateLesson(incoming4, existing4, {
    targetClassIds: ['c3'],
    targetClassName: 'KID2A',
    teacherClasses: mockTeacherClasses,
  });
  console.log(`  Result: ${isDup4 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDup4) {
    throw new Error('FAILED: Different classes must NOT be duplicate even if titles match!');
  }
  console.log('  ✓ PASSED: Correctly identified as NOT DUPLICATE (different classes)');

  // CASE 5:
  // Library search with findDuplicateInLibrary
  console.log('\n- Testing Case 5: findDuplicateInLibrary across whole library');
  const library = [existing1, existing2, existing3, existing4];
  const foundDupForIncoming1 = findDuplicateInLibrary(incoming1, library, {
    targetClassIds: ['c3'],
    targetClassName: 'KID2A',
    teacherClasses: mockTeacherClasses,
  });
  // incoming1 is KID2A / MY FATHER -> should match existing2 (dict_father_kid2a), NOT existing1 (MY PET)!
  if (!foundDupForIncoming1 || foundDupForIncoming1.id !== 'dict_father_kid2a') {
    throw new Error(
      `FAILED: Expected to find dict_father_kid2a, got ${foundDupForIncoming1?.id}`
    );
  }
  console.log(`  ✓ PASSED: Matched exact duplicate: ${foundDupForIncoming1.title} (${foundDupForIncoming1.id})`);

  console.log('\nALL DUPLICATE DETECTION TESTS PASSED PERFECTLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
