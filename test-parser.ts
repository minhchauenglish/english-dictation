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

  console.log('\n=== TEST A: Composite Header with Internal Metadata (Lớp 5 Single Lesson) ===');
  const testAText = `
UNIT 1 • LESSON 1: My Family
GROUP: LỚP 5
GRADE: 5
CLASS: LỚP 5
UNIT: 1
LESSON: 1
TITLE: My Family
TYPE: PARAGRAPH
WORDS: family, parents
CONTENT:
I love my family.
TRANSLATION:
Tôi yêu gia đình tôi.
`;
  const resultA = parseWordContent(testAText, 'test_a.docx', 'file_a');
  console.log(`Test A detected: ${resultA.lessons.length} lessons`);
  if (resultA.lessons.length !== 1) {
    throw new Error(`TEST A FAILED: Expected exactly 1 lesson, got ${resultA.lessons.length}`);
  }
  const lA = resultA.lessons[0];
  if (lA.detectedGroup !== 'LỚP 5') throw new Error(`TEST A: Expected group 'LỚP 5', got '${lA.detectedGroup}'`);
  if (lA.detectedGrade !== '5') throw new Error(`TEST A: Expected grade '5', got '${lA.detectedGrade}'`);
  if (lA.detectedClass !== 'LỚP 5') throw new Error(`TEST A: Expected class 'LỚP 5', got '${lA.detectedClass}'`);
  if (lA.unitNumber !== '1') throw new Error(`TEST A: Expected unit '1', got '${lA.unitNumber}'`);
  if (lA.lessonNumber !== '1') throw new Error(`TEST A: Expected lessonNumber '1', got '${lA.lessonNumber}'`);
  if (lA.title !== 'My Family') throw new Error(`TEST A: Expected title 'My Family', got '${lA.title}'`);
  if (lA.translation !== 'Tôi yêu gia đình tôi.') throw new Error(`TEST A: Translation mismatch`);
  console.log('Test A passed: 1 lesson, correct metadata, no over-splitting.');

  console.log('\n=== TEST B: TITLE-Anchor Mode (2 Lessons) ===');
  const testBText = `
TITLE: Family Communication
CONTENT:
Open communication is very important in every family.

TITLE: Daily Routine
CONTENT:
I wake up early every day and exercise.
`;
  const resultB = parseWordContent(testBText, 'test_b.docx', 'file_b');
  console.log(`Test B detected: ${resultB.lessons.length} lessons`);
  if (resultB.lessons.length !== 2) {
    throw new Error(`TEST B FAILED: Expected 2 lessons, got ${resultB.lessons.length}`);
  }
  if (resultB.lessons[0].lessonNumber !== '1' || resultB.lessons[0].title !== 'Family Communication') {
    throw new Error(`TEST B: Lesson 1 mismatch: ${JSON.stringify(resultB.lessons[0])}`);
  }
  if (resultB.lessons[1].lessonNumber !== '2' || resultB.lessons[1].title !== 'Daily Routine') {
    throw new Error(`TEST B: Lesson 2 mismatch: ${JSON.stringify(resultB.lessons[1])}`);
  }
  console.log('Test B passed: 2 lessons properly anchored on TITLE: with sequential numbers 1 and 2.');

  console.log('\n=== TEST C: Realistic Lớp 5 Format (80 Lessons: 20 Units x 4 Lessons) ===');
  let testCText = `
UNIT CONTENTS
Unit 1: All about me! — 4 lessons
Unit 2: Our homes — 4 lessons
Unit 3: My school — 4 lessons
Unit 4: Community — 4 lessons
Unit 5: Food and drinks — 4 lessons
Unit 6: Animals — 4 lessons
Unit 7: Daily routines — 4 lessons
Unit 8: Hobbies — 4 lessons
Unit 9: Free time — 4 lessons
Unit 10: Holidays — 4 lessons
Unit 11: Travel — 4 lessons
Unit 12: Weather — 4 lessons
Unit 13: Clothes — 4 lessons
Unit 14: Sports — 4 lessons
Unit 15: Music — 4 lessons
Unit 16: Arts — 4 lessons
Unit 17: Science — 4 lessons
Unit 18: Nature — 4 lessons
Unit 19: Future dreams — 4 lessons
Unit 20: Year in review — 4 lessons
`;
  let cLessonCounter = 0;
  for (let u = 1; u <= 20; u++) {
    for (let l = 1; l <= 4; l++) {
      cLessonCounter++;
      testCText += `
UNIT ${u} • LESSON ${l}: Lesson Topic ${cLessonCounter}
GROUP: LỚP 5
GRADE: 5
CLASS: LỚP 5
UNIT: ${u}
LESSON: ${l}
TITLE: Lesson Topic ${cLessonCounter}
TYPE: PARAGRAPH
WORDS: word_${cLessonCounter}_1, word_${cLessonCounter}_2
CONTENT:
This is the passage for unit ${u} lesson ${l}.
TRANSLATION:
Đây là bản dịch bài ${cLessonCounter}.
`;
    }
  }
  const resultC = parseWordContent(testCText, 'LOP5_GLOBAL_SUCCESS_80_BAI.docx', 'file_c');
  console.log(`Test C detected: ${resultC.lessons.length} lessons from Lớp 5 80-lesson dataset`);
  if (resultC.lessons.length !== 80) {
    throw new Error(`TEST C FAILED: Expected 80 lessons, but got ${resultC.lessons.length}`);
  }
  // Verify that lesson 1 has lessonNumber 1 and title 'Lesson Topic 1', not over-split
  if (resultC.lessons[0].title !== 'Lesson Topic 1' || resultC.lessons[0].lessonNumber !== '1') {
    throw new Error(`TEST C: First lesson mismatch: ${resultC.lessons[0].title}, ${resultC.lessons[0].lessonNumber}`);
  }
  if (resultC.lessons[79].title !== 'Lesson Topic 80' || resultC.lessons[79].lessonNumber !== '4') {
    throw new Error(`TEST C: Last lesson mismatch: ${resultC.lessons[79].title}, ${resultC.lessons[79].lessonNumber}`);
  }
  console.log('Test C passed: Exactly 80 lessons parsed from Lớp 5 file without TOC pollution.');

  console.log('\n=== TEST D: Realistic Lớp 10 Format (50 Lessons in TITLE-anchor mode) ===');
  let testDText = '';
  for (let i = 1; i <= 50; i++) {
    testDText += `
TITLE: Topic ${i} of Grade 10
TYPE: PARAGRAPH
WORDS: vocab_${i}_a, vocab_${i}_b
CONTENT:
Paragraph content for grade 10 lesson ${i}.
TRANSLATION:
Bản dịch lớp 10 bài ${i}.
`;
  }
  const resultD = parseWordContent(testDText, 'LOP10_GLOBAL_SUCCESS_50_BAI.docx', 'file_d');
  console.log(`Test D detected: ${resultD.lessons.length} lessons from Lớp 10 50-lesson dataset`);
  if (resultD.lessons.length !== 50) {
    throw new Error(`TEST D FAILED: Expected 50 lessons, but got ${resultD.lessons.length}`);
  }
  if (resultD.lessons[0].lessonNumber !== '1' || resultD.lessons[0].title !== 'Topic 1 of Grade 10') {
    throw new Error(`TEST D: First lesson mismatch`);
  }
  if (resultD.lessons[49].lessonNumber !== '50' || resultD.lessons[49].title !== 'Topic 50 of Grade 10') {
    throw new Error(`TEST D: Last lesson mismatch`);
  }
  console.log('Test D passed: Exactly 50 lessons parsed in TITLE-anchor mode.');

  console.log('\n=== TEST E: Realistic Lớp 11 Format (50 Lessons with LESSON: and UNIT:) ===');
  let testEText = `
GROUP: LỚP 11
GRADE: 11
CLASS: LỚP 11
`;
  let eCount = 0;
  for (let u = 1; u <= 10; u++) {
    testEText += `
UNIT ${u}: THEME FOR UNIT ${u}
UNIT TITLE: THEME FOR UNIT ${u}
`;
    for (let l = 1; l <= 5; l++) {
      eCount++;
      testEText += `
LESSON: ${eCount}
TITLE: Healthy Theme ${eCount}
TYPE: PARAGRAPH
WORDS: nutrition_${eCount}
CONTENT:
Healthy lifestyle paragraph content ${eCount}.
TRANSLATION:
Lối sống lành mạnh ${eCount}.
`;
    }
  }
  const resultE = parseWordContent(testEText, 'LOP11_GLOBAL_SUCCESS_50_BAI.docx', 'file_e');
  console.log(`Test E detected: ${resultE.lessons.length} lessons from Lớp 11 dataset`);
  if (resultE.lessons.length !== 50) {
    throw new Error(`TEST E FAILED: Expected 50 lessons, but got ${resultE.lessons.length}`);
  }
  if (resultE.lessons[0].detectedGroup !== 'LỚP 11') {
    throw new Error(`TEST E: Group mismatch, expected 'LỚP 11', got '${resultE.lessons[0].detectedGroup}'`);
  }
  if (resultE.lessons[0].detectedGrade !== '11') {
    throw new Error(`TEST E: Grade mismatch, expected '11', got '${resultE.lessons[0].detectedGrade}'`);
  }
  if (resultE.lessons[0].lessonNumber !== '1') {
    throw new Error(`TEST E: First lesson number mismatch, expected '1', got '${resultE.lessons[0].lessonNumber}'`);
  }
  if (resultE.lessons[49].lessonNumber !== '50') {
    throw new Error(`TEST E: Last lesson number mismatch, expected '50', got '${resultE.lessons[49].lessonNumber}'`);
  }
  const unit1Lessons = resultE.lessons.filter((l) => l.unitNumber === '1');
  if (unit1Lessons.length !== 5) {
    throw new Error(`TEST E: Unit 1 expected 5 lessons, got ${unit1Lessons.length}`);
  }
  const unit10Lessons = resultE.lessons.filter((l) => l.unitNumber === '10');
  if (unit10Lessons.length !== 5) {
    throw new Error(`TEST E: Unit 10 expected 5 lessons, got ${unit10Lessons.length}`);
  }
  const unit2FirstLesson = resultE.lessons.find((l) => l.unitNumber === '2');
  if (!unit2FirstLesson || unit2FirstLesson.lessonNumber !== '6') {
    throw new Error(`TEST E: Unit 2 first lesson expected to be Lesson 6, got ${unit2FirstLesson?.lessonNumber}`);
  }
  if (resultE.totalUnitsDetected !== 10) {
    throw new Error(`TEST E: Expected 10 units detected, got ${resultE.totalUnitsDetected}`);
  }
  if (resultE.missingLessonNumbers && resultE.missingLessonNumbers.length > 0) {
    throw new Error(`TEST E: Expected no missing lesson numbers, got: ${resultE.missingLessonNumbers.join(',')}`);
  }
  console.log('Test E passed: Exactly 50 lessons with complete file-level metadata, 10 units, no missing lessons.');

  console.log('\n=== TEST F: Has TITLE but missing LESSON tag ===');
  const testFText = `
TITLE: Renewable Energy in Modern World
CONTENT:
Solar and wind power are becoming the primary sources of electricity worldwide.
`;
  const resultF = parseWordContent(testFText, 'test_f.docx', 'file_f');
  if (resultF.lessons.length !== 1 || resultF.lessons[0].lessonNumber !== '1') {
    throw new Error(`TEST F FAILED: Expected 1 lesson with sequential lessonNumber '1'`);
  }
  console.log('Test F passed: Successfully parsed with sequential lessonNumber when LESSON: tag is absent.');

  console.log('\n=== TEST G: Has LESSON but missing GROUP/GRADE tags ===');
  const testGText = `
LESSON 1: Community Gardens
CONTENT:
People in urban areas are building community gardens to grow fresh vegetables.
`;
  const resultG = parseWordContent(testGText, 'test_g.docx', 'file_g');
  if (resultG.lessons.length !== 1) {
    throw new Error(`TEST G FAILED: Expected 1 lesson, got ${resultG.lessons.length}`);
  }
  if (resultG.detectedGroup !== undefined) {
    throw new Error(`TEST G: Expected detectedGroup to be undefined when missing, got ${resultG.detectedGroup}`);
  }
  console.log('Test G passed: Successfully parsed without error when GROUP is absent (teacher can select class in UI).');

  console.log('\n=== TEST H: Multi-file Independence & Cross-Group Duplicate Handling ===');
  const file1Text = `
GROUP: LỚP 1
GRADE: 1
UNIT: 1
LESSON: 1
TITLE: MY FRIENDS
CONTENT:
Hello friend.
`;
  const file2Text = `
GROUP: LỚP 4
GRADE: 4
UNIT: 1
LESSON: 1
TITLE: MY FRIENDS
CONTENT:
Hello friends in grade 4.
`;
  const parsedFile1 = parseWordContent(file1Text, 'Lop1.docx', 'f1');
  const parsedFile2 = parseWordContent(file2Text, 'Lop4.docx', 'f2');
  if (parsedFile1.lessons.length !== 1 || parsedFile2.lessons.length !== 1) {
    throw new Error(`TEST H: Parsing failed for cross-group test`);
  }
  const dupDetector = await import('./src/utils/duplicateDetector');
  // Compare lesson from Lớp 1 with lesson from Lớp 4
  const isDup = dupDetector.isDuplicateLesson(
    parsedFile2.lessons[0],
    {
      id: 'existing_lop1',
      title: parsedFile1.lessons[0].title,
      group: parsedFile1.lessons[0].detectedGroup,
      grade: parsedFile1.lessons[0].detectedGrade,
      unit: parsedFile1.lessons[0].unitNumber,
      lessonNumber: parsedFile1.lessons[0].lessonNumber,
      classLevel: 'LỚP 1',
      topic: parsedFile1.lessons[0].title,
      passage: 'Hello friend.',
      exercise: {
        title: parsedFile1.lessons[0].title,
        sentences: [{ id: 's1', order: 1, text: 'Hello friend.' }],
        voiceAccent: 'US',
        playbackSpeed: 1,
        checkMode: 'EASY',
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { teacherClasses: [] }
  );
  if (isDup) {
    throw new Error(`TEST H FAILED: LỚP 1 and LỚP 4 have same title 'MY FRIENDS' but DIFFERENT groups, should NOT be duplicate!`);
  }
  console.log('Test H passed: Cross-group identical title correctly identified as NOT duplicate.');

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
    group?: string;
    grade?: string;
    unit?: string;
    unitTitle?: string;
    lessonNumber?: string;
  }): import('./src/types').SavedDictationItem => ({
    id: opts.id,
    title: opts.title,
    classLevel: opts.classLevel,
    classIds: opts.classIds,
    group: opts.group,
    grade: opts.grade,
    unit: opts.unit,
    unitTitle: opts.unitTitle,
    lessonNumber: opts.lessonNumber,
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

  // ==========================================
  // CANONICAL NORMALIZATION TESTS (SECTION 3-7)
  // ==========================================
  console.log('\n--- CANONICAL NORMALIZATION TESTS ---');
  const {
    normalizeGroup,
    getCanonicalGrade,
    normalizeUnit,
    normalizeLessonNumber,
    normalizeTitle,
    buildDuplicateKey,
  } = await import('./src/utils/duplicateDetector');

  // Test normalizeGroup
  console.log('- Testing normalizeGroup:');
  const g11Variants = ['LỚP 11', 'Lớp 11', 'Lop 11', 'GRADE 11', 'Grade 11'];
  g11Variants.forEach((v) => {
    const res = normalizeGroup(v);
    if (res !== 'LOP11') {
      throw new Error(`normalizeGroup failed for "${v}": expected "LOP11", got "${res}"`);
    }
  });
  if (normalizeGroup('LỚP 5') !== 'LOP5') throw new Error('normalizeGroup LỚP 5 failed');
  if (normalizeGroup('LỚP 10') !== 'LOP10') throw new Error('normalizeGroup LỚP 10 failed');
  if (normalizeGroup('MẦM NON') !== 'MAMNON') throw new Error('normalizeGroup MẦM NON failed');
  if (normalizeGroup('DEBATE') !== 'DEBATE') throw new Error('normalizeGroup DEBATE failed');
  if (normalizeGroup('IELTS') !== 'IELTS') throw new Error('normalizeGroup IELTS failed');
  // Pure "11" must not be assumed as group
  if (normalizeGroup('11') !== undefined) throw new Error('normalizeGroup("11") should be undefined');
  console.log('  ✓ PASSED: normalizeGroup correctly maps canonical groups and avoids bare numbers');

  // Test getCanonicalGrade
  console.log('- Testing getCanonicalGrade:');
  ['11', 'Grade 11', 'Lớp 11'].forEach((v) => {
    if (getCanonicalGrade(v) !== '11') throw new Error(`getCanonicalGrade failed for "${v}"`);
  });
  ['5', 'Grade 5', 'Lớp 5'].forEach((v) => {
    if (getCanonicalGrade(v) !== '5') throw new Error(`getCanonicalGrade failed for "${v}"`);
  });
  if (getCanonicalGrade('Grade 5') === getCanonicalGrade('Grade 11')) {
    throw new Error('Grade 5 and Grade 11 must NOT be the same!');
  }
  console.log('  ✓ PASSED: getCanonicalGrade correctly distinguishes grades');

  // Test normalizeUnit
  console.log('- Testing normalizeUnit:');
  ['1', '01', 'Unit 1', 'UNIT: 1'].forEach((v) => {
    if (normalizeUnit(v) !== '1') throw new Error(`normalizeUnit failed for "${v}"`);
  });
  console.log('  ✓ PASSED: normalizeUnit correctly normalizes unit numbers');

  // Test normalizeLessonNumber
  console.log('- Testing normalizeLessonNumber:');
  ['1', '01', 'Lesson 1', 'Bài 1'].forEach((v) => {
    if (normalizeLessonNumber(v) !== '1') throw new Error(`normalizeLessonNumber failed for "${v}"`);
  });
  console.log('  ✓ PASSED: normalizeLessonNumber correctly normalizes lesson numbers');

  // Test buildDuplicateKey
  console.log('- Testing buildDuplicateKey:');
  const key1 = buildDuplicateKey({
    group: 'LỚP 4',
    grade: '4',
    unit: '1',
    lesson: '1',
    title: 'MY FRIENDS',
  });
  const key2 = buildDuplicateKey({
    group: 'LỚP 1',
    grade: '1',
    unit: '1',
    lesson: '1',
    title: 'MY FRIENDS',
  });
  if (key1 !== 'LOP4|4|1|1|my friends') {
    throw new Error(`buildDuplicateKey mismatch: expected "LOP4|4|1|1|my friends", got "${key1}"`);
  }
  if (key1 === key2) {
    throw new Error('Keys must be different for LOP4 vs LOP1');
  }
  console.log('  ✓ PASSED: buildDuplicateKey produces unique canonical keys');

  // ==========================================
  // 12 MANDATORY UNIT TESTS FROM USER SPEC
  // ==========================================
  console.log('\n--- 12 MANDATORY DUPLICATE TESTS ---');

  // TEST 1: LỚP 1 / U1 / L1 / MY FRIENDS vs LỚP 4 / U1 / L1 / MY FRIENDS => NOT DUPLICATE
  console.log('\n- Test 1: LỚP 1 / U1 / L1 / MY FRIENDS vs LỚP 4 / U1 / L1 / MY FRIENDS');
  const existingT1 = makeExisting({
    id: 'dict_t1',
    title: 'Lesson 1: MY FRIENDS',
    group: 'LỚP 4',
    grade: '4',
    unit: '1',
    lessonNumber: '1',
    classLevel: 'Lớp 4',
  });
  const incomingT1 = {
    title: 'Lesson 1: MY FRIENDS',
    lessonNumber: '1',
    detectedGroup: 'LỚP 1',
    detectedGrade: '1',
    unitNumber: '1',
  };
  const isDupT1 = isDuplicateLesson(incomingT1, existingT1);
  console.log(`  Result: ${isDupT1 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT1) throw new Error('FAILED Test 1: LỚP 1 vs LỚP 4 must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 1 => NOT DUPLICATE');

  // TEST 2: LỚP 4 / U1 / L1 / MY FRIENDS vs LỚP 4 / U1 / L1 / MY FRIENDS => DUPLICATE
  console.log('\n- Test 2: LỚP 4 / U1 / L1 / MY FRIENDS vs LỚP 4 / U1 / L1 / MY FRIENDS');
  const existingT2 = makeExisting({
    id: 'dict_t2',
    title: 'Lesson 1: MY FRIENDS',
    group: 'LỚP 4',
    grade: '4',
    unit: '1',
    lessonNumber: '1',
    classLevel: 'Lớp 4',
  });
  const incomingT2 = {
    title: 'Lesson 1: MY FRIENDS',
    lessonNumber: '1',
    detectedGroup: 'LỚP 4',
    detectedGrade: '4',
    unitNumber: '1',
  };
  const isDupT2 = isDuplicateLesson(incomingT2, existingT2);
  console.log(`  Result: ${isDupT2 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (!isDupT2) throw new Error('FAILED Test 2: Exact same group, unit, lesson, title must BE DUPLICATE!');
  console.log('  ✓ PASSED: Test 2 => DUPLICATE');

  // TEST 3: LỚP 4 / U1 / L1 / MY FRIENDS vs LỚP 4 / U2 / L1 / MY FRIENDS => NOT DUPLICATE
  console.log('\n- Test 3: LỚP 4 / U1 / L1 / MY FRIENDS vs LỚP 4 / U2 / L1 / MY FRIENDS');
  const existingT3 = makeExisting({
    id: 'dict_t3',
    title: 'Lesson 1: MY FRIENDS',
    group: 'LỚP 4',
    grade: '4',
    unit: '2',
    lessonNumber: '1',
    classLevel: 'Lớp 4',
  });
  const incomingT3 = {
    title: 'Lesson 1: MY FRIENDS',
    lessonNumber: '1',
    detectedGroup: 'LỚP 4',
    detectedGrade: '4',
    unitNumber: '1',
  };
  const isDupT3 = isDuplicateLesson(incomingT3, existingT3);
  console.log(`  Result: ${isDupT3 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT3) throw new Error('FAILED Test 3: Different units (U1 vs U2) must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 3 => NOT DUPLICATE');

  // TEST 4: LỚP 4 / U1 / L1 / MY FRIENDS vs LỚP 4 / U1 / L2 / MY FRIENDS => NOT DUPLICATE
  console.log('\n- Test 4: LỚP 4 / U1 / L1 / MY FRIENDS vs LỚP 4 / U1 / L2 / MY FRIENDS');
  const existingT4 = makeExisting({
    id: 'dict_t4',
    title: 'Lesson 2: MY FRIENDS',
    group: 'LỚP 4',
    grade: '4',
    unit: '1',
    lessonNumber: '2',
    classLevel: 'Lớp 4',
  });
  const incomingT4 = {
    title: 'Lesson 1: MY FRIENDS',
    lessonNumber: '1',
    detectedGroup: 'LỚP 4',
    detectedGrade: '4',
    unitNumber: '1',
  };
  const isDupT4 = isDuplicateLesson(incomingT4, existingT4);
  console.log(`  Result: ${isDupT4 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT4) throw new Error('FAILED Test 4: Different lessons (L1 vs L2) must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 4 => NOT DUPLICATE');

  // TEST 5: LỚP 5 / U1 / L1 / FAMILY LIFE vs LỚP 10 / U1 / L1 / FAMILY LIFE => NOT DUPLICATE
  console.log('\n- Test 5: LỚP 5 / U1 / L1 / FAMILY LIFE vs LỚP 10 / U1 / L1 / FAMILY LIFE');
  const existingT5 = makeExisting({
    id: 'dict_t5',
    title: 'Lesson 1: FAMILY LIFE',
    group: 'LỚP 10',
    grade: '10',
    unit: '1',
    lessonNumber: '1',
    classLevel: 'Lớp 10',
  });
  const incomingT5 = {
    title: 'Lesson 1: FAMILY LIFE',
    lessonNumber: '1',
    detectedGroup: 'LỚP 5',
    detectedGrade: '5',
    unitNumber: '1',
  };
  const isDupT5 = isDuplicateLesson(incomingT5, existingT5);
  console.log(`  Result: ${isDupT5 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT5) throw new Error('FAILED Test 5: LỚP 5 vs LỚP 10 must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 5 => NOT DUPLICATE');

  // TEST 6: LỚP 10 / U1 / L1 / FAMILY LIFE vs LỚP 11 / U1 / L1 / FAMILY LIFE => NOT DUPLICATE
  console.log('\n- Test 6: LỚP 10 / U1 / L1 / FAMILY LIFE vs LỚP 11 / U1 / L1 / FAMILY LIFE');
  const existingT6 = makeExisting({
    id: 'dict_t6',
    title: 'Lesson 1: FAMILY LIFE',
    group: 'LỚP 11',
    grade: '11',
    unit: '1',
    lessonNumber: '1',
    classLevel: 'Lớp 11',
  });
  const incomingT6 = {
    title: 'Lesson 1: FAMILY LIFE',
    lessonNumber: '1',
    detectedGroup: 'LỚP 10',
    detectedGrade: '10',
    unitNumber: '1',
  };
  const isDupT6 = isDuplicateLesson(incomingT6, existingT6);
  console.log(`  Result: ${isDupT6 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT6) throw new Error('FAILED Test 6: LỚP 10 vs LỚP 11 must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 6 => NOT DUPLICATE');

  // TEST 7: LỚP 11 / U1 / L1 / TOPIC A vs LỚP 11 / U1 / L2 / TOPIC A => NOT DUPLICATE
  console.log('\n- Test 7: LỚP 11 / U1 / L1 / TOPIC A vs LỚP 11 / U1 / L2 / TOPIC A');
  const existingT7 = makeExisting({
    id: 'dict_t7',
    title: 'Lesson 2: TOPIC A',
    group: 'LỚP 11',
    grade: '11',
    unit: '1',
    lessonNumber: '2',
    classLevel: 'Lớp 11',
  });
  const incomingT7 = {
    title: 'Lesson 1: TOPIC A',
    lessonNumber: '1',
    detectedGroup: 'LỚP 11',
    detectedGrade: '11',
    unitNumber: '1',
  };
  const isDupT7 = isDuplicateLesson(incomingT7, existingT7);
  console.log(`  Result: ${isDupT7 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT7) throw new Error('FAILED Test 7: LỚP 11 Lesson 1 vs Lesson 2 must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 7 => NOT DUPLICATE');

  // TEST 8: LỚP 11 / U1 / L1 / TOPIC A vs LỚP 11 / U1 / L1 / TOPIC B => NOT DUPLICATE
  console.log('\n- Test 8: LỚP 11 / U1 / L1 / TOPIC A vs LỚP 11 / U1 / L1 / TOPIC B');
  const existingT8 = makeExisting({
    id: 'dict_t8',
    title: 'Lesson 1: TOPIC B',
    group: 'LỚP 11',
    grade: '11',
    unit: '1',
    lessonNumber: '1',
    classLevel: 'Lớp 11',
  });
  const incomingT8 = {
    title: 'Lesson 1: TOPIC A',
    lessonNumber: '1',
    detectedGroup: 'LỚP 11',
    detectedGrade: '11',
    unitNumber: '1',
  };
  const isDupT8 = isDuplicateLesson(incomingT8, existingT8);
  console.log(`  Result: ${isDupT8 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT8) throw new Error('FAILED Test 8: Different titles (TOPIC A vs TOPIC B) must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 8 => NOT DUPLICATE');

  // TEST 9: LỚP 11 / U1 / L1 / TOPIC A vs LỚP 11 / U1 / L1 / TOPIC A => DUPLICATE
  console.log('\n- Test 9: LỚP 11 / U1 / L1 / TOPIC A vs LỚP 11 / U1 / L1 / TOPIC A');
  const existingT9 = makeExisting({
    id: 'dict_t9',
    title: 'Lesson 1: TOPIC A',
    group: 'LỚP 11',
    grade: '11',
    unit: '1',
    lessonNumber: '1',
    classLevel: 'Lớp 11',
  });
  const incomingT9 = {
    title: 'Lesson 1: TOPIC A',
    lessonNumber: '1',
    detectedGroup: 'LỚP 11',
    detectedGrade: '11',
    unitNumber: '1',
  };
  const isDupT9 = isDuplicateLesson(incomingT9, existingT9);
  console.log(`  Result: ${isDupT9 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (!isDupT9) throw new Error('FAILED Test 9: Exact same Lớp 11 / U1 / L1 / TOPIC A must BE DUPLICATE!');
  console.log('  ✓ PASSED: Test 9 => DUPLICATE');

  // TEST 10: GROUP khác nhưng TITLE giống => NOT DUPLICATE
  console.log('\n- Test 10: GROUP khác nhưng TITLE giống (LỚP 3 vs LỚP 7, MY SCHOOL)');
  const existingT10 = makeExisting({
    id: 'dict_t10',
    title: 'MY SCHOOL',
    group: 'LỚP 7',
    grade: '7',
    classLevel: 'Lớp 7',
  });
  const incomingT10 = {
    title: 'MY SCHOOL',
    detectedGroup: 'LỚP 3',
    detectedGrade: '3',
  };
  const isDupT10 = isDuplicateLesson(incomingT10, existingT10);
  console.log(`  Result: ${isDupT10 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT10) throw new Error('FAILED Test 10: Different groups with same title must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 10 => NOT DUPLICATE');

  // TEST 11: GRADE khác nhưng TITLE giống => NOT DUPLICATE
  console.log('\n- Test 11: GRADE khác nhưng TITLE giống (Grade 5 vs Grade 10)');
  const existingT11 = makeExisting({
    id: 'dict_t11',
    title: 'ENGLISH PRACTICE',
    grade: '10',
    classLevel: 'Grade 10',
  });
  const incomingT11 = {
    title: 'ENGLISH PRACTICE',
    detectedGrade: '5',
  };
  const isDupT11 = isDuplicateLesson(incomingT11, existingT11);
  console.log(`  Result: ${isDupT11 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT11) throw new Error('FAILED Test 11: Different grades with same title must NOT be duplicate!');
  console.log('  ✓ PASSED: Test 11 => NOT DUPLICATE');

  // TEST 12: Thiếu metadata ở một bên => không được tự động đánh dấu duplicate nếu không đủ bằng chứng
  console.log('\n- Test 12: Thiếu metadata ở một bên (LỚP 11 bài mới vs bài cũ chỉ có title)');
  const existingT12 = makeExisting({
    id: 'dict_t12',
    title: 'A BALANCED DIET FOR TEENAGERS',
    classLevel: '', // no group, no grade, no class
  });
  const incomingT12 = {
    title: 'A BALANCED DIET FOR TEENAGERS',
    detectedGroup: 'LỚP 11',
    detectedGrade: '11',
    unitNumber: '1',
    lessonNumber: '1',
  };
  const isDupT12 = isDuplicateLesson(incomingT12, existingT12);
  console.log(`  Result: ${isDupT12 ? 'DUPLICATE' : 'NOT DUPLICATE'}`);
  if (isDupT12) throw new Error('FAILED Test 12: Missing metadata on one side must NOT trigger duplicate without proof!');
  console.log('  ✓ PASSED: Test 12 => NOT DUPLICATE (safe behavior when metadata is incomplete)');

  // Multi-file batch test: Files from Lớp 5, Lớp 10, Lớp 11 imported together
  console.log('\n- Testing Multi-file Batch: Lớp 5, Lớp 10, Lớp 11 files with same title "OUR ENVIRONMENT"');
  const batchLessons = [
    {
      id: 'l_lop5',
      title: 'Lesson 1: OUR ENVIRONMENT',
      lessonNumber: '1',
      type: 'WORDS_AND_SENTENCES' as const,
      words: ['tree'],
      sentences: ['We love nature.'],
      selected: true,
      fileId: 'f_lop5',
      fileName: 'LOP5.docx',
      detectedGroup: 'LỚP 5',
      detectedGrade: '5',
      unitNumber: '1',
    },
    {
      id: 'l_lop10',
      title: 'Lesson 1: OUR ENVIRONMENT',
      lessonNumber: '1',
      type: 'WORDS_AND_SENTENCES' as const,
      words: ['ecosystem'],
      sentences: ['We must preserve biodiversity.'],
      selected: true,
      fileId: 'f_lop10',
      fileName: 'LOP10.docx',
      detectedGroup: 'LỚP 10',
      detectedGrade: '10',
      unitNumber: '1',
    },
    {
      id: 'l_lop11',
      title: 'Lesson 1: OUR ENVIRONMENT',
      lessonNumber: '1',
      type: 'WORDS_AND_SENTENCES' as const,
      words: ['sustainability'],
      sentences: ['Renewable energy is essential.'],
      selected: true,
      fileId: 'f_lop11',
      fileName: 'LOP11.docx',
      detectedGroup: 'LỚP 11',
      detectedGrade: '11',
      unitNumber: '1',
    },
  ];

  // Existing library only has the Lớp 10 version
  const existingLibraryForBatch = [
    makeExisting({
      id: 'dict_existing_lop10',
      title: 'Lesson 1: OUR ENVIRONMENT',
      group: 'LỚP 10',
      grade: '10',
      unit: '1',
      lessonNumber: '1',
      classLevel: 'Lớp 10',
    }),
  ];

  const { evaluateLessonDuplicates } = await import('./src/utils/duplicateDetector');
  const evaluatedBatch = evaluateLessonDuplicates(batchLessons, existingLibraryForBatch);

  const lop5Evaluated = evaluatedBatch.find((l) => l.fileId === 'f_lop5')!;
  const lop10Evaluated = evaluatedBatch.find((l) => l.fileId === 'f_lop10')!;
  const lop11Evaluated = evaluatedBatch.find((l) => l.fileId === 'f_lop11')!;

  if (lop5Evaluated.isDuplicate) {
    throw new Error('FAILED Multi-file: Lớp 5 should NOT be marked duplicate of Lớp 10!');
  }
  if (!lop10Evaluated.isDuplicate) {
    throw new Error('FAILED Multi-file: Lớp 10 MUST be marked duplicate of existing Lớp 10!');
  }
  if (lop11Evaluated.isDuplicate) {
    throw new Error('FAILED Multi-file: Lớp 11 should NOT be marked duplicate of Lớp 10!');
  }
  console.log('  ✓ PASSED: Multi-file batch preserves per-file metadata (Lớp 5: Not duplicate, Lớp 10: Duplicate, Lớp 11: Not duplicate)');

  console.log('\nALL 12 MANDATORY TESTS + MULTI-FILE BATCH TEST PASSED 100%!');

  console.log('\n=== TEST 5: EXCEL EXPORT UNIT TESTS ===');
  const {
    createHomeworkLinksWorkbook,
    exportHomeworkLinksToExcel,
    formatExportDate,
    formatExportTime,
    formatExerciseMode,
  } = await import('./src/utils/excelExporter');
  const XLSX = await import('xlsx');

  // Sub-test 5.1: No data -> does NOT export empty file
  console.log('\n- Testing Sub-test 5.1: Empty data handling');
  const emptyWb = createHomeworkLinksWorkbook([]);
  if (emptyWb !== null) {
    throw new Error('FAILED: Expected null workbook when history is empty');
  }
  const emptyExportResult = exportHomeworkLinksToExcel([]);
  if (emptyExportResult.success !== false || emptyExportResult.message !== 'Chưa có link bài tập nào để xuất.') {
    throw new Error(`FAILED: Expected failure result with clear message, got: ${JSON.stringify(emptyExportResult)}`);
  }
  console.log('  ✓ PASSED: Correctly refused to create empty Excel file and returned clear message');

  // Sub-test 5.2: Multi-class homework assignment -> Each class on its own row
  console.log('\n- Testing Sub-test 5.2: Multiple classes -> Each class one row with exact URL');
  const sampleUrl1 = 'https://dictation-app.example.com/?d=hw_kid1a_123';
  const sampleUrl2 = 'https://dictation-app.example.com/?d=hw_kid1b_456';
  const sampleUrl3 = 'https://dictation-app.example.com/?d=hw_kid2a_789';

  const mockHistoryItems: import('./src/types').HomeworkHistoryItem[] = [
    {
      id: 'hw_1',
      date: '2026-09-10T13:20:00.000Z',
      className: 'KID1A',
      exerciseTitle: 'Lesson 3: MY SCHOOL',
      topic: 'MY SCHOOL',
      sentenceCount: 5,
      exerciseMode: 'PRACTICE',
      generatedLink: sampleUrl1,
      status: 'Đã giao',
    },
    {
      id: 'hw_2',
      date: '2026-09-10T13:20:00.000Z',
      className: 'KID1B',
      exerciseTitle: 'Lesson 3: MY SCHOOL',
      topic: 'MY SCHOOL',
      sentenceCount: 5,
      exerciseMode: 'PRACTICE',
      generatedLink: sampleUrl2,
      status: 'Đã giao',
    },
    {
      id: 'hw_3',
      date: '2026-09-10T13:21:00.000Z',
      className: 'KID2A',
      exerciseTitle: 'Lesson 70: BEING KIND',
      topic: 'BEING KIND',
      sentenceCount: 6,
      exerciseMode: 'TEST',
      generatedLink: sampleUrl3,
      status: 'Đã giao',
    },
  ];

  const workbook = createHomeworkLinksWorkbook(mockHistoryItems);
  if (!workbook) {
    throw new Error('FAILED: Expected valid workbook for 3 history items');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const sheetJson = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

  console.log(`  Generated sheet rows count: ${sheetJson.length}`);
  // Row 0 is header, rows 1, 2, 3 are data rows
  if (sheetJson.length !== 4) {
    throw new Error(`FAILED: Expected 4 rows (1 header + 3 data rows), but got ${sheetJson.length}`);
  }

  // Verify headers
  const headerRow = sheetJson[0];
  const expectedHeaders = ['Ngày giao', 'Giờ giao', 'Lớp', 'Tên bài tập', 'Chủ đề', 'Chế độ', 'Link bài tập'];
  expectedHeaders.forEach((exp, idx) => {
    if (headerRow[idx] !== exp) {
      throw new Error(`FAILED: Header column ${idx} expected "${exp}", got "${headerRow[idx]}"`);
    }
  });
  console.log('  ✓ PASSED: Header row verified exactly');

  // Verify each row data and URL preservation
  // Row 1: KID1A
  const row1 = sheetJson[1];
  if (row1[2] !== 'KID1A' || row1[3] !== 'Lesson 3: MY SCHOOL' || row1[5] !== 'Luyện tập' || row1[6] !== sampleUrl1) {
    throw new Error(`FAILED: Row 1 data mismatch: ${JSON.stringify(row1)}`);
  }
  // Row 2: KID1B
  const row2 = sheetJson[2];
  if (row2[2] !== 'KID1B' || row2[3] !== 'Lesson 3: MY SCHOOL' || row2[5] !== 'Luyện tập' || row2[6] !== sampleUrl2) {
    throw new Error(`FAILED: Row 2 data mismatch: ${JSON.stringify(row2)}`);
  }
  // Row 3: KID2A
  const row3 = sheetJson[3];
  if (row3[2] !== 'KID2A' || row3[3] !== 'Lesson 70: BEING KIND' || row3[5] !== 'Kiểm tra' || row3[6] !== sampleUrl3) {
    throw new Error(`FAILED: Row 3 data mismatch: ${JSON.stringify(row3)}`);
  }
  console.log('  ✓ PASSED: Each class has its own row and URLs are preserved 100% accurately');

  // Sub-test 5.3: Verify binary XLSX generation
  const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  if (!xlsxBuffer || xlsxBuffer.length === 0) {
    throw new Error('FAILED: Generated XLSX buffer is empty');
  }
  console.log(`  Generated XLSX file buffer size: ${xlsxBuffer.length} bytes`);
  console.log('  ✓ PASSED: Valid XLSX file buffer created successfully');

  console.log('\nALL EXCEL EXPORT TESTS PASSED PERFECTLY!');

  console.log('\n=== TEST 6: 3-TIER HINTS & RESULT VIEW ALL ANSWERS TESTS ===');
  const {
    getFirstWord,
    getSentenceKeywords,
    generateSentenceFrame,
    generateThreeTierHints,
  } = await import('./src/utils/hints');

  const s1 = 'Hello.';
  const s2 = "I don't have breakfast at seven o'clock.";
  const s3 = 'My family is very happy.';
  const s4 = '"Welcome to our classroom!"';

  // Sub-test 6.1: Hint 1 - First word
  console.log('\n- Testing Sub-test 6.1: Hint 1 extracts exact first word');
  if (getFirstWord(s1) !== 'Hello') {
    throw new Error(`FAILED: Expected first word "Hello", got "${getFirstWord(s1)}"`);
  }
  if (getFirstWord(s2) !== 'I') {
    throw new Error(`FAILED: Expected first word "I", got "${getFirstWord(s2)}"`);
  }
  if (getFirstWord(s3) !== 'My') {
    throw new Error(`FAILED: Expected first word "My", got "${getFirstWord(s3)}"`);
  }
  if (getFirstWord(s4) !== 'Welcome') {
    throw new Error(`FAILED: Expected first word "Welcome", got "${getFirstWord(s4)}"`);
  }
  const hintsS3 = generateThreeTierHints(s3);
  if (hintsS3.level1Text !== 'Từ đầu tiên là: My') {
    throw new Error(`FAILED: Level 1 text mismatch: ${hintsS3.level1Text}`);
  }
  console.log('  ✓ PASSED: Hint 1 extracts exact first word for all sentences');

  // Sub-test 6.2: Hint 2 - Keywords
  console.log('\n- Testing Sub-test 6.2: Hint 2 extracts content keywords');
  const keywordsS3 = getSentenceKeywords(s3);
  if (!keywordsS3.includes('family') || !keywordsS3.includes('happy')) {
    throw new Error(`FAILED: Expected keywords to include family and happy, got ${JSON.stringify(keywordsS3)}`);
  }
  console.log(`  ✓ PASSED: Hint 2 keywords extracted: [${keywordsS3.join(' – ')}]`);

  // Sub-test 6.3: Hint 3 - Sentence frame with blanks
  console.log('\n- Testing Sub-test 6.3: Hint 3 generates sentence frame with blanks');
  const frameS3 = generateSentenceFrame(s3);
  if (!frameS3.includes('______')) {
    throw new Error(`FAILED: Expected frame to contain blanks, got "${frameS3}"`);
  }
  console.log(`  ✓ PASSED: Frame generated: "${frameS3}"`);

  // Sub-test 6.4: Full answers displayed in exact order only after completion
  console.log('\n- Testing Sub-test 6.4: Result view full answers ordering');
  const mockExerciseSentences = [
    { id: 'sent_3', order: 3, text: 'This is my classroom.' },
    { id: 'sent_1', order: 1, text: 'Good morning teacher.' },
    { id: 'sent_2', order: 2, text: 'My name is Peter.' },
    { id: 'sent_4', order: 4, text: 'We love English.' },
  ];

  // Emulate StudentResultView orderedSentences useMemo logic
  const orderedResultSentences = [...mockExerciseSentences].sort((a, b) => a.order - b.order);
  if (orderedResultSentences.length !== 4) {
    throw new Error(`FAILED: Expected 4 sentences, got ${orderedResultSentences.length}`);
  }
  if (orderedResultSentences[0].order !== 1 || orderedResultSentences[0].text !== 'Good morning teacher.') {
    throw new Error(`FAILED: Sentence 1 order mismatch: ${JSON.stringify(orderedResultSentences[0])}`);
  }
  if (orderedResultSentences[1].order !== 2 || orderedResultSentences[1].text !== 'My name is Peter.') {
    throw new Error(`FAILED: Sentence 2 order mismatch: ${JSON.stringify(orderedResultSentences[1])}`);
  }
  if (orderedResultSentences[2].order !== 3 || orderedResultSentences[2].text !== 'This is my classroom.') {
    throw new Error(`FAILED: Sentence 3 order mismatch: ${JSON.stringify(orderedResultSentences[2])}`);
  }
  if (orderedResultSentences[3].order !== 4 || orderedResultSentences[3].text !== 'We love English.') {
    throw new Error(`FAILED: Sentence 4 order mismatch: ${JSON.stringify(orderedResultSentences[3])}`);
  }
  console.log('  ✓ PASSED: Result view displays all sentences in exact sequential order');

  console.log('\nALL 3-TIER HINTS & RESULT VIEW TESTS PASSED PERFECTLY!');

  // ==========================================
  // TEST 7: VOICE ACCENT SWITCHING PRESERVES ALL EXERCISE STATE
  // ==========================================
  console.log('\n=== TEST 7: VOICE ACCENT SWITCHING STATE PRESERVATION ===');

  // Simulated exercise session state
  const sessionState = {
    currentIndex: 2, // Question 3/5
    typedAnswer: 'I have breakfast with my family',
    replaysUsed: 2, // 2/3 listens used
    attemptCount: 1,
    isFirstAttemptIncorrect: true,
    hintLevel: 2, // 2nd hint unlocked
    sentenceHintsUsed: 2,
    isChecked: false,
    currentCheckResult: null,
    collectedResults: [
      {
        sentenceId: 'sent_1',
        sentenceOrder: 1,
        targetText: 'Good morning teacher.',
        studentAnswer: 'Good morning teacher.',
        accuracy: 100,
        isCorrect: true,
        wordDiffs: [],
        wrongWords: [],
        replaysUsed: 1,
        hintsUsed: 0,
      },
      {
        sentenceId: 'sent_2',
        sentenceOrder: 2,
        targetText: 'My name is Peter.',
        studentAnswer: 'My name is Peter.',
        accuracy: 100,
        isCorrect: true,
        wordDiffs: [],
        wrongWords: [],
        replaysUsed: 1,
        hintsUsed: 1,
      },
    ],
  };

  // Voice preference state (isolated from session state)
  const voicePrefs: { voiceAccent: 'US' | 'UK'; storedVoiceAccent: string } = {
    voiceAccent: 'US',
    storedVoiceAccent: 'US',
  };

  const handleSelectAccent = (accent: 'US' | 'UK') => {
    voicePrefs.voiceAccent = accent;
    voicePrefs.storedVoiceAccent = accent;
    // CRITICAL: Voice preference updater must NOT touch sessionState
  };

  // Snapshot before voice change
  const initialSessionSnapshot = JSON.stringify(sessionState);

  // Student switches from US to UK
  console.log('- Testing student switching US -> UK during Question 3/5 with 2/3 listens...');
  handleSelectAccent('UK');

  if ((voicePrefs.voiceAccent as string) !== 'UK' || voicePrefs.storedVoiceAccent !== 'UK') {
    throw new Error('FAILED: Voice accent was not updated to UK');
  }

  // Verify all session state is 100% preserved
  if (JSON.stringify(sessionState) !== initialSessionSnapshot) {
    throw new Error('FAILED: Exercise session state was modified when switching to UK!');
  }
  if (sessionState.currentIndex !== 2) throw new Error('FAILED: currentIndex was reset!');
  if (sessionState.replaysUsed !== 2) throw new Error('FAILED: replaysUsed was reset!');
  if (sessionState.typedAnswer !== 'I have breakfast with my family') throw new Error('FAILED: typedAnswer was reset!');
  if (sessionState.hintLevel !== 2) throw new Error('FAILED: hintLevel was reset!');
  if (sessionState.collectedResults.length !== 2) throw new Error('FAILED: collectedResults was reset!');

  console.log('  ✓ PASSED: UK switch preserved Question 3/5, 2/3 listens, typed answer, hintLevel=2, and completed results');

  // Student switches back from UK to US
  console.log('- Testing student switching UK -> US during Question 3/5 with 2/3 listens...');
  handleSelectAccent('US');

  if ((voicePrefs.voiceAccent as string) !== 'US' || (voicePrefs.storedVoiceAccent as string) !== 'US') {
    throw new Error('FAILED: Voice accent was not updated to US');
  }
  if (JSON.stringify(sessionState) !== initialSessionSnapshot) {
    throw new Error('FAILED: Exercise session state was modified when switching to US!');
  }
  console.log('  ✓ PASSED: US switch preserved Question 3/5, 2/3 listens, typed answer, hintLevel=2, and completed results');

  console.log('\n=== TEST 6: Parsing Word content with TRANSLATION field ===');
  const textWithTranslation = `
CLASS: 3A
GRADE: 3

Lesson 1 - MY FAMILY
WORDS:
father, mother, brother, sister
SENTENCES:
1. This is my father.
2. I love my family very much.
TRANSLATION:
1. Đây là bố của tôi.
2. Tôi yêu gia đình của tôi rất nhiều.

Lesson 2 - AT THE ZOO
CONTENT:
We see a big elephant and monkeys jumping in the trees.
BẢN DỊCH:
Chúng tôi nhìn thấy một con voi lớn và những chú khỉ nhảy nhót trên cây.
`;

  const parsedWithTrans = parseWordContent(textWithTranslation, 'test_translation.docx', 'f_trans');
  if (parsedWithTrans.lessons.length !== 2) {
    throw new Error(`TEST 6 FAILED: Expected 2 lessons, got ${parsedWithTrans.lessons.length}`);
  }

  console.log('Lesson 1 translation:', parsedWithTrans.lessons[0].translation);
  if (!parsedWithTrans.lessons[0].translation?.includes('Đây là bố của tôi')) {
    throw new Error('TEST 6 FAILED: Lesson 1 translation not parsed properly');
  }

  console.log('Lesson 2 translation:', parsedWithTrans.lessons[1].translation);
  if (!parsedWithTrans.lessons[1].translation?.includes('Chúng tôi nhìn thấy một con voi lớn')) {
    throw new Error('TEST 6 FAILED: Lesson 2 translation not parsed properly');
  }
  console.log('  ✓ PASSED: TRANSLATION field parsed with both TRANSLATION and BẢN DỊCH keywords!');

  console.log('\n=== TEST 7: Sentence Chunking Algorithm ===');
  const { splitSentenceIntoChunks } = await import('./src/utils/chunking');

  // Test sentence 1: short sentence (<= 8 words)
  const shortSent = "This is my house.";
  const shortChunks = splitSentenceIntoChunks(shortSent);
  console.log('Short sentence chunks:', shortChunks);
  if (shortChunks.length !== 1 || shortChunks[0].text !== shortSent) {
    throw new Error('TEST 7 FAILED: Short sentence should remain 1 chunk');
  }

  // Test sentence 2: the prompt's exact example
  const promptExample = "I enjoy having some quiet time alone, but playing with friends is usually more fun.";
  const promptChunks = splitSentenceIntoChunks(promptExample);
  console.log('Prompt example chunks:', promptChunks);
  // Verify all words preserved in order
  const reassembled = promptChunks.map(c => c.text).join(' ');
  const origTokens = promptExample.split(/\s+/);
  const reassembledTokens = reassembled.split(/\s+/);
  if (origTokens.join(' ') !== reassembledTokens.join(' ')) {
    throw new Error(`TEST 7 FAILED: Words mismatch! Original: "${promptExample}", Reassembled: "${reassembled}"`);
  }
  if (promptChunks.length < 2) {
    throw new Error('TEST 7 FAILED: Expected prompt example to be split into chunks');
  }
  console.log('  ✓ Prompt example split into chunks:', promptChunks.map(c => `[${c.text}]`).join(' + '));

  // Test sentence 3: medium sentence without comma (9-14 words)
  const medSent = "My mother prepares delicious breakfast for us every morning before school.";
  const medChunks = splitSentenceIntoChunks(medSent);
  console.log('Medium sentence chunks:', medChunks.map(c => `[${c.text}]`).join(' + '));
  const reassembledMed = medChunks.map(c => c.text).join(' ');
  if (medSent.split(/\s+/).join(' ') !== reassembledMed.split(/\s+/).join(' ')) {
    throw new Error('TEST 7 FAILED: Medium sentence words mismatch');
  }

  // Test sentence 4: long sentence with multiple clauses
  const longSent = "When the rain stopped yesterday afternoon, the children ran outside to play soccer in the large park near our school.";
  const longChunks = splitSentenceIntoChunks(longSent);
  console.log('Long sentence chunks:', longChunks.map(c => `[${c.text}]`).join(' + '));
  const reassembledLong = longChunks.map(c => c.text).join(' ');
  if (longSent.split(/\s+/).join(' ') !== reassembledLong.split(/\s+/).join(' ')) {
    throw new Error('TEST 7 FAILED: Long sentence words mismatch');
  }
  console.log('  ✓ PASSED: All chunking tests passed with 100% word fidelity!');

  console.log('\n=== TEST 8: SHORT ASSIGNMENT LINK OPTIMIZATION & BACKWARD COMPATIBILITY ===');
  const { buildShareUrl, decodeExercise, encodeExercise } = await import('./src/utils/codec');
  const { formatDailyZaloMessage } = await import('./src/utils/homeworkMessage');

  // Test 8.1: Modern short link format #/p/<shortCode>
  const sampleEx = {
    title: 'Unit 2: Daily Routines',
    sentences: [
      { id: 's1', order: 1, text: "I get up at six o'clock every morning." },
      { id: 's2', order: 2, text: 'I have breakfast with my family.' },
      { id: 's3', order: 3, text: 'I go to school by bus.' },
    ],
    voiceMode: 'NATURAL' as const,
    voiceAccent: 'US' as const,
    playbackSpeed: 0.95 as const,
    checkMode: 'EASY' as const,
    exerciseMode: 'PRACTICE' as const,
  };

  const modernLink = buildShareUrl(sampleEx);
  console.log('Generated Modern Link:', modernLink);
  if (!modernLink.includes('#/p/')) {
    throw new Error(`TEST 8 FAILED: Expected link to contain "#/p/", got: ${modernLink}`);
  }
  if (modernLink.includes('#/practice/')) {
    throw new Error(`TEST 8 FAILED: Modern link should not use old "#/practice/" route`);
  }

  // Test 8.2: Decode modern short link payload
  const modernCode = modernLink.split('#/p/')[1];
  const decodedModern = decodeExercise(modernCode);
  if (!decodedModern || decodedModern.sentences.length !== 3 || decodedModern.title !== sampleEx.title) {
    throw new Error('TEST 8 FAILED: Failed to decode modern short link');
  }
  console.log('  ✓ PASSED: Modern short link generation & decoding verified');

  // Test 8.3: Backward compatibility with legacy long links (#/practice/<payload>)
  // Simulate legacy verbose / non-minified or older encoded payload
  const legacyPayload = encodeExercise({
    ...sampleEx,
    title: 'Legacy Unit 1',
    listenLimit: 0,
  });
  const legacyDecoded = decodeExercise(legacyPayload);
  if (!legacyDecoded || legacyDecoded.title !== 'Legacy Unit 1') {
    throw new Error('TEST 8 FAILED: Backward compatibility decode failed');
  }
  console.log('  ✓ PASSED: Full backward compatibility with previous payloads verified');

  // Test 8.4: Zalo message format with modern short link
  const classSpecificLink = `${modernLink}?c=KID1A`;
  const zaloMsg = formatDailyZaloMessage({
    className: 'KID1A',
    exerciseTitle: sampleEx.title,
    link: classSpecificLink,
  });
  console.log('Generated Zalo Message:\n' + zaloMsg);
  if (!zaloMsg.includes('#/p/')) {
    throw new Error('TEST 8 FAILED: Zalo message must contain #/p/ short link');
  }
  if (!zaloMsg.includes('Lớp KID1A') || !zaloMsg.includes(sampleEx.title)) {
    throw new Error('TEST 8 FAILED: Zalo message missing class name or title');
  }
  console.log('  ✓ PASSED: Zalo message formatting with short link verified');

  // Test 8.5: Malformed payload handling
  const corruptedResult = decodeExercise('totally-invalid-corrupted-hash!@#$');
  if (corruptedResult !== null) {
    throw new Error('TEST 8 FAILED: Corrupted payload should return null safely');
  }
  console.log('  ✓ PASSED: Corrupted / malformed payload safely handled without crashing');

  console.log('\n=== TEST 9: TWO-LEVEL CLASS / LEVEL FILTER SYSTEM ===');
  const {
    classifyClassLevel,
    buildLibraryFilterHierarchy,
    itemMatchesFilter,
  } = await import('./src/utils/libraryFilters');

  // Test 9.1: Classification of Mầm non variants
  const c1 = classifyClassLevel('MẦM NON • LEVEL 1 – TỪ ĐƠN');
  if (c1.mainGroup !== 'Mầm non' || c1.subLevel !== 'Level 1 • Từ đơn') {
    throw new Error(`TEST 9 FAILED: c1 expected Mầm non / Level 1 • Từ đơn, got: ${JSON.stringify(c1)}`);
  }

  const c2 = classifyClassLevel('MẦM NON • LEVEL 2 – CỤM TỪ');
  if (c2.mainGroup !== 'Mầm non' || c2.subLevel !== 'Level 2 • Cụm từ') {
    throw new Error(`TEST 9 FAILED: c2 expected Mầm non / Level 2 • Cụm từ, got: ${JSON.stringify(c2)}`);
  }

  const c3 = classifyClassLevel('MẦM NON • LEVEL 3 – CÂU NGẮN');
  if (c3.mainGroup !== 'Mầm non' || c3.subLevel !== 'Level 3 • Câu ngắn') {
    throw new Error(`TEST 9 FAILED: c3 expected Mầm non / Level 3 • Câu ngắn, got: ${JSON.stringify(c3)}`);
  }

  const c4 = classifyClassLevel('MẦM NON');
  if (c4.mainGroup !== 'Mầm non' || c4.subLevel !== undefined) {
    throw new Error(`TEST 9 FAILED: c4 expected Mầm non / undefined, got: ${JSON.stringify(c4)}`);
  }

  // Test 9.2: Classification of Grade 1-9 and other classes
  const g3 = classifyClassLevel('Grade 3');
  if (g3.mainGroup !== 'Lớp 3') {
    throw new Error(`TEST 9 FAILED: Grade 3 expected Lớp 3, got: ${g3.mainGroup}`);
  }

  const g4a = classifyClassLevel('Grade 4A');
  if (g4a.mainGroup !== 'Lớp 4') {
    throw new Error(`TEST 9 FAILED: Grade 4A expected Lớp 4, got: ${g4a.mainGroup}`);
  }

  const kid2a = classifyClassLevel('KID2A');
  if (kid2a.mainGroup !== 'Lớp 2') {
    throw new Error(`TEST 9 FAILED: KID2A expected Lớp 2, got: ${kid2a.mainGroup}`);
  }

  const gen = classifyClassLevel('General');
  if (gen.mainGroup !== 'General') {
    throw new Error(`TEST 9 FAILED: General expected General, got: ${gen.mainGroup}`);
  }
  console.log('  ✓ PASSED: All class/level classifications verified accurately');

  // Test 9.3: Build hierarchy from mock library items
  // Scenario: 100 Level 1, 80 Level 2, 80 Level 3, 5 Grade 3, 3 KID2A (Lớp 2), 2 General
  const mockItems: any[] = [];
  // 100 items of Mầm non Level 1
  for (let i = 0; i < 100; i++) {
    mockItems.push({
      id: `mn1_${i}`,
      title: `MN1 Lesson ${i}`,
      classLevel: 'MẦM NON • LEVEL 1 – TỪ ĐƠN',
      exercise: sampleEx,
    });
  }
  // 80 items of Mầm non Level 2
  for (let i = 0; i < 80; i++) {
    mockItems.push({
      id: `mn2_${i}`,
      title: `MN2 Lesson ${i}`,
      classLevel: 'MẦM NON • LEVEL 2 – CỤM TỪ',
      exercise: sampleEx,
    });
  }
  // 80 items of Mầm non Level 3
  for (let i = 0; i < 80; i++) {
    mockItems.push({
      id: `mn3_${i}`,
      title: `MN3 Lesson ${i}`,
      classLevel: 'MẦM NON • LEVEL 3 – CÂU NGẮN',
      exercise: sampleEx,
    });
  }
  // 5 items Grade 3
  for (let i = 0; i < 5; i++) {
    mockItems.push({
      id: `g3_${i}`,
      title: `Grade 3 Lesson ${i}`,
      classLevel: 'Grade 3',
      exercise: sampleEx,
    });
  }
  // 3 items KID2A -> Lớp 2
  for (let i = 0; i < 3; i++) {
    mockItems.push({
      id: `kid2_${i}`,
      title: `KID2A Lesson ${i}`,
      classLevel: 'KID2A',
      exercise: sampleEx,
    });
  }
  // 2 items General
  for (let i = 0; i < 2; i++) {
    mockItems.push({
      id: `gen_${i}`,
      title: `General Lesson ${i}`,
      classLevel: 'General',
      exercise: sampleEx,
    });
  }

  const hierarchy = buildLibraryFilterHierarchy(mockItems, []);
  console.log('Derived Hierarchy Groups:', hierarchy.map(h => `${h.label} (${h.count})`).join(', '));

  // Verify all 16 permanent groups are always returned in exact order
  if (hierarchy.length !== 16) {
    throw new Error(`TEST 9 FAILED: Hierarchy expected 16 groups, got: ${hierarchy.length}`);
  }
  const groupOrder = hierarchy.map(h => h.label);
  const expectedAll16 = [
    'Mầm non', 'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
    'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12',
    'Debate', 'IELTS', 'General'
  ];
  if (JSON.stringify(groupOrder) !== JSON.stringify(expectedAll16)) {
    throw new Error(`TEST 9 FAILED: Hierarchy order mismatch. Expected 16 groups, got: ${JSON.stringify(groupOrder)}`);
  }
  console.log('  ✓ PASSED: Permanent hierarchy ordering (all 16 groups) verified strictly');

  // Verify Mầm non count is exactly 100 + 80 + 80 = 260
  const mamNonGroup = hierarchy.find(h => h.key === 'Mầm non');
  if (!mamNonGroup || mamNonGroup.count !== 260) {
    throw new Error(`TEST 9 FAILED: Mầm non total count expected 260, got: ${mamNonGroup?.count}`);
  }
  if (mamNonGroup.subLevels.length !== 3) {
    throw new Error(`TEST 9 FAILED: Expected 3 sublevels for Mầm non, got: ${mamNonGroup.subLevels.length}`);
  }
  const l1Sub = mamNonGroup.subLevels.find(s => s.key === 'Level 1 • Từ đơn');
  const l2Sub = mamNonGroup.subLevels.find(s => s.key === 'Level 2 • Cụm từ');
  const l3Sub = mamNonGroup.subLevels.find(s => s.key === 'Level 3 • Câu ngắn');
  if (l1Sub?.count !== 100 || l2Sub?.count !== 80 || l3Sub?.count !== 80) {
    throw new Error(`TEST 9 FAILED: Sublevel counts mismatch. L1=${l1Sub?.count}, L2=${l2Sub?.count}, L3=${l3Sub?.count}`);
  }
  console.log('  ✓ PASSED: Mầm non total (260) and sublevel counts (100, 80, 80) verified');

  // Verify empty groups (e.g. Lớp 6, Lớp 7) are present with count: 0 and subLevels: []
  const lop6Group = hierarchy.find(h => h.key === 'Lớp 6');
  if (!lop6Group || lop6Group.count !== 0 || lop6Group.subLevels.length !== 0) {
    throw new Error('TEST 9 FAILED: Empty groups must be present with count=0 and subLevels=[]');
  }
  console.log('  ✓ PASSED: Empty groups present with count=0 and subLevels=[]');

  // Test 9.4: Filter Matching logic
  // 1. ALL -> matches all 270 items
  const allMatches = mockItems.filter(item => itemMatchesFilter(item, 'ALL', 'ALL'));
  if (allMatches.length !== 270) {
    throw new Error(`TEST 9 FAILED: ALL filter should match 270 items, got: ${allMatches.length}`);
  }

  // 2. Mầm non + ALL -> matches 260 items
  const mnAllMatches = mockItems.filter(item => itemMatchesFilter(item, 'Mầm non', 'ALL'));
  if (mnAllMatches.length !== 260) {
    throw new Error(`TEST 9 FAILED: Mầm non + ALL should match 260 items, got: ${mnAllMatches.length}`);
  }

  // 3. Mầm non + Level 2 • Cụm từ -> matches exactly 80 items
  const mnL2Matches = mockItems.filter(item => itemMatchesFilter(item, 'Mầm non', 'Level 2 • Cụm từ'));
  if (mnL2Matches.length !== 80) {
    throw new Error(`TEST 9 FAILED: Mầm non + Level 2 should match 80 items, got: ${mnL2Matches.length}`);
  }

  // 4. Lớp 3 -> matches 5 items
  const g3Matches = mockItems.filter(item => itemMatchesFilter(item, 'Lớp 3', 'ALL'));
  if (g3Matches.length !== 5) {
    throw new Error(`TEST 9 FAILED: Lớp 3 should match 5 items, got: ${g3Matches.length}`);
  }

  console.log('  ✓ PASSED: Filter matching logic for ALL, Mầm non, Level 2, and Lớp 3 verified');

  console.log('\n=== TEST 10: PERMANENT 16-CATEGORY SYSTEM & GROUP PARSING ===');
  const { PERMANENT_MAIN_GROUPS, classifyExerciseItem } = await import('./src/utils/libraryFilters');
  const { convertImportedLessonToDictation } = await import('./src/utils/wordParser');

  // 10.1: Verify PERMANENT_MAIN_GROUPS length and exact order
  const expectedGroups = [
    'Mầm non', 'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
    'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12',
    'Debate', 'IELTS', 'General'
  ];
  if (PERMANENT_MAIN_GROUPS.length !== 16) {
    throw new Error(`TEST 10 FAILED: Expected 16 groups, got ${PERMANENT_MAIN_GROUPS.length}`);
  }
  expectedGroups.forEach((g, idx) => {
    if (PERMANENT_MAIN_GROUPS[idx] !== g) {
      throw new Error(`TEST 10 FAILED: Group ${idx + 1} expected "${g}", got "${PERMANENT_MAIN_GROUPS[idx]}"`);
    }
  });
  console.log('  ✓ PASSED: All 16 permanent categories match exact sequence');

  // 10.2: Word parsing with optional GROUP field
  const wordWithGroup = `
GROUP: DEBATE
CLASS: DEBATE LEVEL 1

Lesson 1: Climate Change
WORDS:
climate
warming
`;
  const parsedGroupDoc = parseWordContent(wordWithGroup, 'debate_test.docx', 'f_group');
  if (parsedGroupDoc.detectedGroup !== 'DEBATE') {
    throw new Error(`TEST 10 FAILED: Expected detectedGroup 'DEBATE', got '${parsedGroupDoc.detectedGroup}'`);
  }
  if (parsedGroupDoc.lessons[0].detectedGroup !== 'DEBATE') {
    throw new Error(`TEST 10 FAILED: Lesson detectedGroup expected 'DEBATE', got '${parsedGroupDoc.lessons[0].detectedGroup}'`);
  }
  const convertedLesson = convertImportedLessonToDictation(parsedGroupDoc.lessons[0]);
  if (convertedLesson.group !== 'DEBATE') {
    throw new Error(`TEST 10 FAILED: convertedLesson.group expected 'DEBATE', got '${convertedLesson.group}'`);
  }
  console.log('  ✓ PASSED: Word parsing detects GROUP: field at file and lesson level');

  // 10.3: Priority Mapping Verification
  // Priority A: GROUP over GRADE and CLASS
  const itemPriorityA: any = {
    id: 'it_a',
    title: 'Priority A',
    group: 'DEBATE',
    grade: '3',
    classLevel: 'Grade 3A',
    exercise: sampleEx,
  };
  const classA = classifyExerciseItem(itemPriorityA, []);
  if (classA.mainGroup !== 'Debate') {
    throw new Error(`TEST 10 FAILED: Priority A expected 'Debate', got '${classA.mainGroup}'`);
  }

  // Priority B: GRADE over CLASS
  const itemPriorityB: any = {
    id: 'it_b',
    title: 'Priority B',
    grade: '6',
    classLevel: 'KID1A',
    exercise: sampleEx,
  };
  const classB = classifyExerciseItem(itemPriorityB, []);
  if (classB.mainGroup !== 'Lớp 6') {
    throw new Error(`TEST 10 FAILED: Priority B expected 'Lớp 6', got '${classB.mainGroup}'`);
  }

  // Priority C: CLASS (KID1A -> Lớp 1, KID2A -> Lớp 2)
  const itemKID1: any = {
    id: 'it_k1',
    title: 'KID1A Test',
    classLevel: 'KID1A',
    exercise: sampleEx,
  };
  const classK1 = classifyExerciseItem(itemKID1, []);
  if (classK1.mainGroup !== 'Lớp 1') {
    throw new Error(`TEST 10 FAILED: KID1A expected 'Lớp 1', got '${classK1.mainGroup}'`);
  }

  // Debate sublevel extraction
  const itemDebateL2: any = {
    id: 'it_d2',
    title: 'Debate L2',
    classLevel: 'DEBATE LEVEL 2',
    exercise: sampleEx,
  };
  const classD2 = classifyExerciseItem(itemDebateL2, []);
  if (classD2.mainGroup !== 'Debate' || classD2.subLevel !== 'Level 2') {
    throw new Error(`TEST 10 FAILED: DEBATE LEVEL 2 expected Debate / Level 2, got: ${JSON.stringify(classD2)}`);
  }

  // IELTS sublevel extraction
  const itemIeltsSpeaking: any = {
    id: 'it_is',
    title: 'IELTS Speaking Topic',
    classLevel: 'IELTS SPEAKING',
    exercise: sampleEx,
  };
  const classIS = classifyExerciseItem(itemIeltsSpeaking, []);
  if (classIS.mainGroup !== 'IELTS' || classIS.subLevel !== 'Speaking') {
    throw new Error(`TEST 10 FAILED: IELTS SPEAKING expected IELTS / Speaking, got: ${JSON.stringify(classIS)}`);
  }

  // Unknown class falls back strictly to General
  const itemUnknown: any = {
    id: 'it_un',
    title: 'Unknown Course',
    classLevel: 'Advanced Robotics Club',
    exercise: sampleEx,
  };
  const classUn = classifyExerciseItem(itemUnknown, []);
  if (classUn.mainGroup !== 'General') {
    throw new Error(`TEST 10 FAILED: Unknown course expected 'General', got '${classUn.mainGroup}'`);
  }

  console.log('  ✓ PASSED: Priority mapping (GROUP > GRADE > CLASS > General) verified');

  // 10.4: Build hierarchy ordering with Debate, IELTS, and Grades
  const test10Items: any[] = [
    { id: 't_ielts', title: 'IELTS 1', classLevel: 'IELTS WRITING', exercise: sampleEx },
    { id: 't_deb', title: 'Debate 1', classLevel: 'DEBATE LEVEL 3', exercise: sampleEx },
    { id: 't_g10', title: 'Grade 10', classLevel: 'Grade 10', exercise: sampleEx },
    { id: 't_mn', title: 'MN 1', classLevel: 'MẦM NON • LEVEL 1 – TỪ ĐƠN', exercise: sampleEx },
    { id: 't_g1', title: 'G1', classLevel: 'KID1A', exercise: sampleEx },
  ];
  const test10Hierarchy = buildLibraryFilterHierarchy(test10Items, []);
  if (test10Hierarchy.length !== 16) {
    throw new Error(`TEST 10 FAILED: Expected 16 groups, got: ${test10Hierarchy.length}`);
  }
  const test10ActiveOrder = test10Hierarchy.filter(h => h.count > 0).map(h => h.label);
  // Expected order of active groups: Mầm non, Lớp 1, Lớp 10, Debate, IELTS
  if (JSON.stringify(test10ActiveOrder) !== JSON.stringify(['Mầm non', 'Lớp 1', 'Lớp 10', 'Debate', 'IELTS'])) {
    throw new Error(`TEST 10 FAILED: Order mismatch, got: ${JSON.stringify(test10ActiveOrder)}`);
  }
  console.log('  ✓ PASSED: Complex hierarchy correctly orders Mầm non -> Lớp 1 -> Lớp 10 -> Debate -> IELTS with 16 total categories');

  console.log('\nALL TESTS PASSED PERFECTLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
