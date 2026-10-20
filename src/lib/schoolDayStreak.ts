// Streak of consecutive school days the student actually attended, built from
// roll-call records rather than app logins. Only dates that have attendance
// records count as school days, so weekends, holidays and days a teacher
// didn't take roll call never break the streak.
//
// Per date: attended if present/late in at least one lesson; excused if every
// absence that day is excused (status or approved justification) - neutral,
// neither adds nor breaks; otherwise an unexcused absence, which breaks it.

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  status: "present" | "absent" | "late" | "excused";
  justified?: boolean;
}

type DayResult = "attended" | "neutral" | "absent";

function classifyDays(records: AttendanceDay[]): [string, DayResult][] {
  const byDate = new Map<string, DayResult>();
  for (const r of records) {
    const prev = byDate.get(r.date);
    const cur: DayResult =
      r.status === "present" || r.status === "late" ? "attended"
      : r.status === "excused" || r.justified ? "neutral"
      : "absent";
    // attended beats absent beats neutral
    if (!prev || cur === "attended" || (cur === "absent" && prev === "neutral")) byDate.set(r.date, cur);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function computeSchoolDayStreak(records: AttendanceDay[]): { current: number; longest: number; totalDays: number } {
  const days = classifyDays(records);
  let run = 0;
  let longest = 0;
  let totalDays = 0;
  for (const [, result] of days) {
    if (result === "attended") {
      run++;
      totalDays++;
      longest = Math.max(longest, run);
    } else if (result === "absent") {
      run = 0;
    }
  }
  return { current: run, longest, totalDays };
}
