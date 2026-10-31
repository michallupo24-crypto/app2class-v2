import { describe, expect, it } from "vitest";
import { analyzeQuestions } from "./questionAnalytics";
import type { QuizAnswer } from "./quizAnswers";

const q = (id: string, answer: string, correct: boolean): QuizAnswer => ({
  questionId: id, questionText: `שאלה ${id}`, answer, correctAnswer: id === "q1" ? "56" : "פריז", correct,
});

describe("analyzeQuestions", () => {
  it("ranks questions hardest first and groups wrong answers", () => {
    const stats = analyzeQuestions([
      { studentId: "a", name: "דנה", answers: [q("q1", "56", true), q("q2", "לונדון", false)] },
      { studentId: "b", name: "יואב", answers: [q("q1", "54", false), q("q2", "לונדון ", false)] },
      { studentId: "c", name: "נועה", answers: [q("q1", "56", true), q("q2", "פריז", true)] },
    ]);
    expect(stats.map((s) => s.questionId)).toEqual(["q2", "q1"]);
    expect(stats[0]).toMatchObject({ answered: 3, correct: 1, successRate: 33 });
    expect(stats[0].wrongAnswers).toEqual([{ answer: "לונדון", count: 2, students: ["דנה", "יואב"] }]);
    expect(stats[1].successRate).toBe(67);
  });

  it("counts each student once per question", () => {
    const stats = analyzeQuestions([
      { studentId: "a", name: "דנה", answers: [q("q1", "54", false), q("q1", "56", true)] },
    ]);
    expect(stats[0]).toMatchObject({ answered: 1, correct: 1, wrongAnswers: [] });
  });

  it("breaks ties by the quiz's own order", () => {
    const stats = analyzeQuestions(
      [{ studentId: "a", name: "דנה", answers: [q("q1", "56", true), q("q2", "פריז", true)] }],
      new Map([["q1", 2], ["q2", 1]]),
    );
    expect(stats.map((s) => s.questionId)).toEqual(["q2", "q1"]);
  });
});
