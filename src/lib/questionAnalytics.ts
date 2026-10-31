import type { QuizAnswer } from "./quizAnswers";

// Class-wide view of a quiz: per question, how many students got it right and
// which wrong answers came up, so the teacher sees where the class struggled.

export interface StudentAnswers {
  studentId: string;
  name: string;
  answers: QuizAnswer[];
}

export interface QuestionStat {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  answered: number;
  correct: number;
  /** 0-100, rounded. */
  successRate: number;
  /** Most common first. */
  wrongAnswers: { answer: string; count: number; students: string[] }[];
}

/**
 * Questions come back hardest first (lowest success rate, then most answered).
 * `order` maps question id to its order_num so ties fall back to the quiz's own
 * order; students see the questions shuffled, so the answer log can't give it.
 */
export function analyzeQuestions(students: StudentAnswers[], order?: Map<string, number>): QuestionStat[] {
  const byQuestion = new Map<string, QuestionStat & { wrong: Map<string, { answer: string; count: number; students: string[] }> }>();

  for (const s of students) {
    // One vote per student per question; if a log ever repeats one, the last answer wins.
    const latest = new Map<string, QuizAnswer>();
    for (const a of s.answers) latest.set(a.questionId, a);

    for (const a of latest.values()) {
      let q = byQuestion.get(a.questionId);
      if (!q) {
        q = {
          questionId: a.questionId, questionText: a.questionText, correctAnswer: a.correctAnswer,
          answered: 0, correct: 0, successRate: 0, wrongAnswers: [], wrong: new Map(),
        };
        byQuestion.set(a.questionId, q);
      }
      q.answered++;
      if (a.correct) { q.correct++; continue; }
      const shown = a.answer.trim() || "—";
      const key = shown.toLowerCase();
      const w = q.wrong.get(key) ?? { answer: shown, count: 0, students: [] };
      w.count++;
      w.students.push(s.name);
      q.wrong.set(key, w);
    }
  }

  return [...byQuestion.values()]
    .map(({ wrong, ...q }) => ({
      ...q,
      successRate: Math.round((q.correct / q.answered) * 100),
      wrongAnswers: [...wrong.values()].sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) =>
      a.successRate - b.successRate
      || b.answered - a.answered
      || (order?.get(a.questionId) ?? 0) - (order?.get(b.questionId) ?? 0));
}
