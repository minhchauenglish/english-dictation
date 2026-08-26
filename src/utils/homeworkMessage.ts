export interface HomeworkMessageParams {
  className: string;
  exerciseTitle: string;
  topic?: string;
  classLevel?: string;
  exerciseMode?: 'PRACTICE' | 'TEST';
  sentenceCount?: number;
  link: string;
}

/**
 * Standard concise Zalo Homework template requested for Daily Homework Manager (V1.2):
 *
 * Lớp KID1A
 *
 * 📚 Bài Dictation hôm nay:
 * Unit 3 Colours
 *
 * Các con luyện nghe và viết câu theo link:
 * [link]
 *
 * Chúc các con học tốt!
 */
export function formatDailyZaloMessage(params: {
  className: string;
  exerciseTitle: string;
  link: string;
}): string {
  const { className, exerciseTitle, link } = params;

  return `Lớp ${className}

📚 Bài Dictation hôm nay:
${exerciseTitle}

Các con luyện nghe và viết câu theo link:
${link}

Chúc các con học tốt!`.trim();
}

/**
 * Formats a comprehensive homework announcement message for detailed guide.
 */
export function formatZaloHomeworkMessage(params: HomeworkMessageParams): string {
  const { className, exerciseTitle, topic, classLevel, exerciseMode, link } = params;

  const modeText = exerciseMode === 'TEST' ? 'Kiểm tra (Test Mode)' : 'Luyện tập (Practice Mode)';
  
  const headerDetails = [
    `🏫 Class: ${className}`,
    `📖 Exercise: ${exerciseTitle}`,
    topic ? `🎯 Topic: ${topic}` : classLevel ? `🎯 Level: ${classLevel}` : null,
    `⏱️ Mode: ${modeText}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `📚 ENGLISH DICTATION HOMEWORK 🎧
--------------------------------
${headerDetails}

📝 Instructions:
1. Bấm vào link bên dưới để bắt đầu làm bài.
2. Bấm 🔊 "NGHE" để nghe phát âm tiếng Anh chuẩn.
3. Gõ lại câu em nghe được vào ô trả lời.
4. Bấm "KIỂM TRA" để xem kết quả và luyện lại từ chưa đúng.

👉 Flow: Listen → Type → Check

🔗 Link bài tập:
${link}

(Học sinh làm trực tiếp trên điện thoại hoặc máy tính, không cần tài khoản hay tải ứng dụng)`.trim();
}

/**
 * Combines messages of all classes into one batch string for fast 1-click clipboard copy.
 */
export function formatBatchAllZaloMessages(
  items: Array<{ className: string; exerciseTitle: string; link: string }>
): string {
  if (!items || items.length === 0) return '';

  return items
    .map((item) => formatDailyZaloMessage(item))
    .join('\n\n------------------------------------\n\n');
}
