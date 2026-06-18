import type { CoreQuestionId, CoreQuestionResult, QuestionStatus } from "./types.js";

const QUESTIONS: Record<CoreQuestionId, { question: string; artifact: string }> = {
  server: {
    question: "Can the harness connect to OpenCode server?",
    artifact: "raw/server.json or summary.md",
  },
  session: {
    question: "Can it create/use a session?",
    artifact: "raw/opencode-session.json",
  },
  "task-message": {
    question: "Can it send a task message?",
    artifact: "raw/opencode-session.json session messages",
  },
  workspace: {
    question: "Can it target the attempt directory?",
    artifact: "input/attempt.json, changes/file-status.json",
  },
  state: {
    question: "Can it observe useful state?",
    artifact: "raw/opencode-session.json session messages/state",
  },
  "diff-status": {
    question: "Can it collect diff/status?",
    artifact: "changes/final.diff, changes/file-status.json",
  },
  checks: {
    question: "Can it run checks?",
    artifact: "checks/checks.json, checks/test-output.txt",
  },
  bundle: {
    question: "Can it write a bundle?",
    artifact: "runs/<run-id>/summary.md",
  },
  "provider-auth": {
    question: "Does provider auth stay local?",
    artifact: "summary.md, config snapshot",
  },
};

export const QUESTION_ORDER = Object.keys(QUESTIONS) as CoreQuestionId[];

export function questionResult(
  id: CoreQuestionId,
  status: QuestionStatus,
  detail: string,
): CoreQuestionResult {
  return {
    id,
    ...QUESTIONS[id],
    status,
    detail,
  };
}

export function baseQuestionResults(reason: string): Record<CoreQuestionId, CoreQuestionResult> {
  return {
    server: questionResult("server", "not tested because precondition missing", reason),
    session: questionResult("session", "not tested because precondition missing", reason),
    "task-message": questionResult("task-message", "not tested because precondition missing", reason),
    workspace: questionResult("workspace", "not tested because precondition missing", reason),
    state: questionResult("state", "not tested because precondition missing", reason),
    "diff-status": questionResult("diff-status", "not tested because precondition missing", reason),
    checks: questionResult("checks", "not tested because precondition missing", reason),
    bundle: questionResult("bundle", "not tested because precondition missing", reason),
    "provider-auth": questionResult(
      "provider-auth",
      "observed",
      "Harness accepts no provider key/token input and writes no credential material.",
    ),
  };
}
