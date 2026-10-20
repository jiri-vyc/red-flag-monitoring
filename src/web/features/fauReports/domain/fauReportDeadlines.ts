/** SVZ-03 čl. 8.8 odst. 2: internal target, counted from the conclusion that the transaction is suspicious. */
export const INTERNAL_LIMIT_WORKING_DAYS = 2;
/** MP FAÚ č. 4, part three, 1.: always shorter than 5 calendar days, counted from the alert. */
export const MAXIMUM_LIMIT_CALENDAR_DAYS = 5;
/** A deadline closer than this shows a warning. */
export const DEADLINE_WARNING_MS = 24 * 60 * 60 * 1000;

const SUNDAY = 0;
const SATURDAY = 6;

/**
 * on_track / approaching / overdue while the report is not submitted; met / missed once it is, by whether it
 * was submitted before the deadline.
 */
export type DeadlineState = "on_track" | "approaching" | "overdue" | "met" | "missed";

export type FauReportDeadline = { dueAt: string; remainingMs: number; state: DeadlineState };

export type FauReportDeadlines = {
  elapsedSinceAlertMs: number;
  elapsedSinceConclusionMs: number;
  internal: FauReportDeadline;
  maximum: FauReportDeadline;
};

function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === SATURDAY || dayOfWeek === SUNDAY;
}

/**
 * Moves forward by working days, keeping the time of day; weekends are skipped in local time. There is no
 * holiday calendar yet, so a Czech public holiday counts as a working day (the deadline can come out a day late).
 */
export function addWorkingDays(start: Date, workingDays: number): Date {
  const result = new Date(start.getTime());
  let remainingDays = workingDays;
  while (remainingDays > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      remainingDays -= 1;
    }
  }
  return result;
}

export function addCalendarDays(start: Date, calendarDays: number): Date {
  const result = new Date(start.getTime());
  result.setDate(result.getDate() + calendarDays);
  return result;
}

function findDeadlineState({
  remainingMs,
  isSubmitted,
}: {
  remainingMs: number;
  isSubmitted: boolean;
}): DeadlineState {
  if (isSubmitted) {
    return remainingMs >= 0 ? "met" : "missed";
  }
  if (remainingMs < 0) {
    return "overdue";
  }
  return remainingMs <= DEADLINE_WARNING_MS ? "approaching" : "on_track";
}

function toDeadline({
  dueAt,
  endMs,
  isSubmitted,
}: {
  dueAt: Date;
  endMs: number;
  isSubmitted: boolean;
}): FauReportDeadline {
  const remainingMs = dueAt.getTime() - endMs;
  return { dueAt: dueAt.toISOString(), remainingMs, state: findDeadlineState({ remainingMs, isSubmitted }) };
}

/** The clock stops when the report is marked as submitted. */
export function computeFauReportDeadlines({
  alertRaisedAt,
  suspicionConcludedAt,
  submittedAt,
  nowMs,
}: {
  alertRaisedAt: string;
  suspicionConcludedAt: string;
  submittedAt: string | null;
  nowMs: number;
}): FauReportDeadlines {
  const isSubmitted = submittedAt !== null;
  const endMs = isSubmitted ? Date.parse(submittedAt) : nowMs;
  const alertRaised = new Date(alertRaisedAt);
  const suspicionConcluded = new Date(suspicionConcludedAt);
  return {
    elapsedSinceAlertMs: endMs - alertRaised.getTime(),
    elapsedSinceConclusionMs: endMs - suspicionConcluded.getTime(),
    internal: toDeadline({
      dueAt: addWorkingDays(suspicionConcluded, INTERNAL_LIMIT_WORKING_DAYS),
      endMs,
      isSubmitted,
    }),
    maximum: toDeadline({
      dueAt: addCalendarDays(alertRaised, MAXIMUM_LIMIT_CALENDAR_DAYS),
      endMs,
      isSubmitted,
    }),
  };
}
