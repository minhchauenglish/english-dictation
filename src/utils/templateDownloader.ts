import { Document, Paragraph, TextRun, Packer } from 'docx';

export const SAMPLE_WORD_DOCX_CONTENT = `CLASS: 1A
GRADE: 1

========================================

Lesson 1 – HELLO

TYPE: WORDS

CONTENT:
hello
hi
goodbye
bye

========================================

Lesson 2 – MY FAMILY

TYPE: WORDS AND SENTENCES

WORDS:
father
mother
brother
sister

SENTENCES:
This is my father.
This is my mother.
I love my family.

========================================

Lesson 3 – MY SCHOOL

TYPE: SENTENCES

CONTENT:
This is my school.
My teacher is nice.
I love my classroom.

TRANSLATION:
Đây là ngôi trường của em.
Cô giáo của em rất hiền.
Em rất yêu quý lớp học của mình.

========================================

Lesson 4 – MY PET

TYPE: WORDS AND SENTENCES

WORDS:
dog
cat
fish

SENTENCES:
I have a cat.
My cat is small.
I love my cat.

TRANSLATION: Em có một chú mèo con đáng yêu.

========================================

HƯỚNG DẪN SOẠN BÀI:
LESSON từ/câu đơn giản dùng CONTENT
LESSON và TITLE phải có trong mỗi bài
LESSON phải có nội dung
UNIT và CONTENT có thể dùng thay thế
BÀI học cần có TITLE
TRANSLATION: Bản dịch tiếng Việt bài học (không bắt buộc)`;

/**
 * Downloads the sample Word template file.
 * First tries to download the pre-generated file from /English_Dictation_Word_Template.docx.
 * If that fails, dynamically builds the .docx using the 'docx' library in the browser.
 */
export async function downloadWordTemplate(): Promise<void> {
  const fileName = 'English_Dictation_Word_Template.docx';

  try {
    // Try fetching from public/ folder first
    const response = await fetch(`/${fileName}`);
    if (response.ok) {
      const blob = await response.blob();
      triggerBlobDownload(blob, fileName);
      return;
    }
  } catch {
    // Continue to dynamic generation fallback
  }

  // Fallback: Dynamically generate docx in browser
  try {
    const lines = SAMPLE_WORD_DOCX_CONTENT.split('\n');
    const paragraphs = lines.map(
      (line) =>
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: 'Calibri',
              size: 24, // 12pt
            }),
          ],
        })
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    triggerBlobDownload(blob, fileName);
  } catch (err) {
    console.error('Failed to generate Word template:', err);
  }
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
