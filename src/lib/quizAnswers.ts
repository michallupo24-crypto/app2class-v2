// Per-question answers of a task_questions quiz, stored as JSON in
// submissions.content so the teacher's submissions view can show them.
// Game modes and code tasks use `content` for their own payloads, so the
// `kind` tag is what tells this format apart.

export interface QuizAnswer {
  questionId: string;
  questionText: string;
  answer: string;
  correctAnswer: string;
  correct: boolean;
}

const KIND = "quiz_answers";

export function serializeQuizAnswers(answers: QuizAnswer[]): string {
  return JSON.stringify({ kind: KIND, answers });
}

export function parseQuizAnswers(content: string | null | undefined): QuizAnswer[] | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed?.kind === KIND && Array.isArray(parsed.answers) ? parsed.answers : null;
  } catch {
    return null;
  }
}
