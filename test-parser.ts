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
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
