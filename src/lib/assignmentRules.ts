import { supabase } from "@/integrations/supabase/client";

// Shared by the three separate student-facing quiz surfaces (StudentPracticePage,
// the quiz dialog in TasksPage, SnakesLaddersGamePage) so "shuffle", "one attempt"
// and "lock device" behave identically everywhere a student can answer
// task_questions - not just in whichever surface happened to get updated first.

export interface AssignmentRules {
  lockDevice: boolean;
  lockDurationMinutes: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  oneAttempt: boolean;
  /** Data Hook "auto-grade" toggle. When false, a quiz submission is left as
   * "submitted" with no grade instead of auto-filling one, so it waits for
   * the teacher's manual grade like any other assignment. attempt_number and
   * time_spent_seconds are always recorded regardless of the Data Hook
   * include-attempts/include-time toggles - those only gate whether
   * TeacherGradesPage bothers to *display* the numbers, not whether they're
   * collected (collecting is free; no reason to also make it conditional). */
  dataHookAutoGrade: boolean;
}

const DEFAULT_RULES: AssignmentRules = {
  lockDevice: false,
  lockDurationMinutes: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  oneAttempt: false,
  dataHookAutoGrade: true,
};

export async function fetchAssignmentRules(assignmentId: string): Promise<AssignmentRules> {
  const { data, error } = await supabase
    .from("assignments")
    .select("lock_device, lock_duration_minutes, shuffle_questions, shuffle_options, one_attempt, data_hook_auto_grade")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) return DEFAULT_RULES;
  return {
    lockDevice: data.lock_device,
    lockDurationMinutes: data.lock_duration_minutes,
    shuffleQuestions: data.shuffle_questions,
    shuffleOptions: data.shuffle_options,
    oneAttempt: data.one_attempt,
    dataHookAutoGrade: data.data_hook_auto_grade,
  };
}

/** Fisher-Yates - unbiased, unlike `.sort(() => Math.random() - 0.5)`. */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** For the "one attempt only" gate: has this student already submitted this assignment? */
export async function hasExistingAttempt(assignmentId: string, studentId: string): Promise<boolean> {
  const { data } = await supabase
    .from("submissions")
    .select("status")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .in("status", ["submitted", "graded"])
    .maybeSingle();
  return !!data;
}

/** Previous attempt_number for this student on this assignment, so a resubmit increments it. */
export async function getNextAttemptNumber(assignmentId: string, studentId: string): Promise<number> {
  const { data } = await supabase
    .from("submissions")
    .select("attempt_number")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle();
  return (data?.attempt_number || 0) + 1;
}

export interface FocusGuardHandle {
  getViolationCount: () => number;
  stop: () => void;
}

/**
 * Best-effort "exam mode": requests fullscreen and counts tab-switches/blurs
 * while active. This is NOT a real device lock - a browser page cannot
 * actually block a student from leaving the app. It's honest monitoring: the
 * violation count is reported to the teacher, not a guarantee nothing happened.
 */
export function startFocusGuard(onViolation: (count: number) => void): FocusGuardHandle {
  let count = 0;
  const bump = () => {
    count += 1;
    onViolation(count);
  };
  const handleVisibility = () => { if (document.hidden) bump(); };
  const handleBlur = () => bump();

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("blur", handleBlur);
  document.documentElement.requestFullscreen?.().catch(() => { /* user/browser may deny fullscreen - monitoring still works without it */ });

  return {
    getViolationCount: () => count,
    stop: () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    },
  };
}
