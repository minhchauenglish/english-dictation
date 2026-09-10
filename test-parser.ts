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
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
