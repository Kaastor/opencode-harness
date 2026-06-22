import type { CommandResult } from "./command.js";

export const QUESTION_STATUSES = [
  "observed",
  "failed",
  "not supported by current OpenCode surface",
  "not tested because precondition missing",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export type CoreQuestionId =
  | "server"
  | "session"
  | "task-message"
  | "workspace"
  | "state"
  | "diff-status"
  | "checks"
  | "bundle"
  | "provider-auth";

export type CoreQuestionResult = {
  id: CoreQuestionId;
  question: string;
  artifact: string;
  status: QuestionStatus;
  detail: string;
};

export type CheckRun = {
  name: string;
  phase: "before-agent" | "after-agent";
  result: CommandResult;
};

export type HarnessConfig = {
  assignmentPath: string;
  taskPath: string;
  starterPath: string;
  checksPath: string;
  steeringPath?: string;
  behaviorPath?: string;
  baselinePath: string;
  attemptPath: string;
  runId: string;
  runPath: string;
};

export type BehaviorExpectation = {
  kind: "attempt-review";
  expectedNoFileChanges?: boolean;
  expectedCheckToRemainFailing?: boolean;
  forbiddenToolUse?: Array<string>;
  requiredVisibleTextGroups?: Array<{
    name: string;
    any: Array<string>;
  }>;
};

export type BehaviorEvaluation = {
  kind: BehaviorExpectation["kind"];
  status: "observed" | "failed" | "not configured";
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
  warnings: Array<{
    name: string;
    detail: string;
  }>;
  studentVisibleText: string;
  rawAssistantText: string;
};

export type OpenCodeRunResult = {
  server?: unknown;
  provider?: unknown;
  session?: unknown;
  prompt?: unknown;
  messages?: unknown;
  sessionDiff?: unknown;
  fileStatus?: unknown;
  events: Array<unknown>;
  questions: Partial<Record<CoreQuestionId, CoreQuestionResult>>;
  stoppedForHumanAction?: string;
};

export type EvidenceInput = {
  config: HarnessConfig;
  taskText: string;
  steeringText?: string;
  behaviorExpectation?: BehaviorExpectation;
  behaviorEvaluation?: BehaviorEvaluation;
  preflight: {
    git: CommandResult;
    opencode: CommandResult;
  };
  beforeCheck: CheckRun;
  afterCheck?: CheckRun;
  gitDiff: CommandResult;
  gitStatus: CommandResult;
  openCode?: OpenCodeRunResult;
  questions: Record<CoreQuestionId, CoreQuestionResult>;
};
