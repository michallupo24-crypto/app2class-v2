import { describe, expect, it } from "vitest";
import { parseQuizAnswers, serializeQuizAnswers, type QuizAnswer } from "./quizAnswers";

const answers: QuizAnswer[] = [
  { questionId: "q1", questionText: "כמה זה 7×8?", answer: "56", correctAnswer: "56", correct: true },
  { questionId: "q2", questionText: "בירת צרפת?", answer: "לונדון", correctAnswer: "פריז", correct: false },
];

describe("quizAnswers", () => {
  it("round-trips answers", () => {
    expect(parseQuizAnswers(serializeQuizAnswers(answers))).toEqual(answers);
  });

  it("ignores other content stored in submissions", () => {
    expect(parseQuizAnswers(null)).toBeNull();
    expect(parseQuizAnswers("print('hello')")).toBeNull();
    expect(parseQuizAnswers(JSON.stringify({ type: "snakes-ladders", position: 42 }))).toBeNull();
  });
});
