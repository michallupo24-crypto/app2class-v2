import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import StudentPracticePage from "./StudentPracticePage";
import type { UserProfile } from "@/hooks/useAuth";

const { toastSpy, insertState } = vi.hoisted(() => ({
  toastSpy: vi.fn(),
  insertState: { error: null as any },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    profile: {
      id: "student-1",
      fullName: "תלמיד בדיקה",
      email: "student@test.com",
      isApproved: true,
      schoolId: "school-1",
      schoolName: "בית ספר בדיקה",
      roles: ["student"],
      avatar: null,
      pendingApprovalsCount: 0,
      unreadChatCount: 0,
    } satisfies UserProfile,
  }),
  useParams: () => ({ assignmentId: "assignment-1" }),
  useNavigate: () => vi.fn(),
}));

const MOCK_ASSIGNMENT = {
  id: "assignment-1",
  title: "מבחן לדוגמה",
  subject: "מתמטיקה",
  type: "quiz",
  description: "",
  lock_device: false,
  lock_duration_minutes: null,
  shuffle_questions: false,
  shuffle_options: false,
  one_attempt: false,
  data_hook_auto_grade: true,
};

const MOCK_QUESTIONS = [
  {
    id: "q1",
    question_type: "multiple_choice",
    question_text: "כמה זה 2+2?",
    options: ["3", "4"],
    correct_answer: "4",
    explanation: "",
    points: 1,
    order_num: 1,
  },
];

function chain(result: { data: any; error: any }) {
  const c: any = {
    select: () => c,
    eq: () => c,
    order: () => c,
    in: () => c,
    not: () => c,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled: any, onRejected: any) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return c;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "assignments") return chain({ data: MOCK_ASSIGNMENT, error: null });
      if (table === "task_questions") return chain({ data: MOCK_QUESTIONS, error: null });
      if (table === "interactive_tasks") return chain({ data: null, error: null });
      if (table === "submissions") {
        return {
          ...chain({ data: null, error: null }),
          insert: () => Promise.resolve(insertState),
        };
      }
      return chain({ data: null, error: null });
    },
  },
}));

async function finishQuizWithWrongAnswer() {
  render(<StudentPracticePage />);
  fireEvent.click(await screen.findByText("התחל בוחן (1 שאלות)"));
  fireEvent.click(await screen.findByText("3"));
  fireEvent.click(await screen.findByText("סיים וצפה בציון"));
}

beforeEach(() => {
  toastSpy.mockClear();
  insertState.error = null;
});

describe("StudentPracticePage save-score status", () => {
  it("shows the saved confirmation once the grade write succeeds", async () => {
    await finishQuizWithWrongAnswer();
    expect(await screen.findByText("הציון נשמר אוטומטית")).toBeInTheDocument();
    expect(screen.queryByText("הציון לא נשמר עקב שגיאה")).not.toBeInTheDocument();
  });

  it("surfaces an error and a retry action instead of a false success message when the write fails", async () => {
    insertState.error = new Error("network down");
    await finishQuizWithWrongAnswer();

    expect(await screen.findByText("הציון לא נשמר עקב שגיאה")).toBeInTheDocument();
    expect(screen.queryByText("הציון נשמר אוטומטית")).not.toBeInTheDocument();
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));

    insertState.error = null;
    fireEvent.click(screen.getByText("נסה לשמור שוב"));

    expect(await screen.findByText("הציון נשמר אוטומטית")).toBeInTheDocument();
  });
});
