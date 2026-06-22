import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { QUESTION_ORDER, questionResult } from "./questions.js";
import type { CoreQuestionId, CoreQuestionResult, EvidenceInput } from "./types.js";

export async function writeEvidenceBundle(input: EvidenceInput): Promise<void> {
  await mkdir(path.join(input.config.runPath, "raw"), { recursive: true });
  await mkdir(path.join(input.config.runPath, "behavior"), { recursive: true });
  await writeInputArtifacts(input);
  await writeRawPlaceholders(input);
  await writeChangeArtifacts(input);
  await writeBehaviorArtifacts(input);
  await writeSummary(input);
}

function mergedQuestions(input: EvidenceInput): Record<CoreQuestionId, CoreQuestionResult> {
  const questions = { ...input.questions };
  if (input.openCode?.questions) {
    for (const [id, result] of Object.entries(input.openCode.questions)) {
      questions[id as CoreQuestionId] = result;
    }
  }

  questions.checks = questionResult(
    "checks",
    input.beforeCheck.result.exitCode !== null ? "observed" : "failed",
    `Before-agent check exit code: ${input.beforeCheck.result.exitCode}.${
      input.afterCheck ? ` After-agent check exit code: ${input.afterCheck.result.exitCode}.` : ""
    }`,
  );
  questions["diff-status"] = questionResult(
    "diff-status",
    isNoIndexDiffResult(input.gitDiff.exitCode) && isNoIndexDiffResult(input.gitStatus.exitCode)
      ? "observed"
      : "failed",
    [
      `git diff --no-index: ${describeNoIndexExit(input.gitDiff.exitCode)}; git diff --no-index --name-status: ${describeNoIndexExit(input.gitStatus.exitCode)}.`,
      `SDK file status: ${describeSdkFileStatus(input.openCode?.fileStatus)}.`,
    ].join(" "),
  );
  questions.bundle = questionResult(
    "bundle",
    "observed",
    `Evidence bundle written to ${input.config.runPath}.`,
  );
  return questions;
}

async function writeInputArtifacts(input: EvidenceInput): Promise<void> {
  if (input.steeringText) {
    await writeFile(path.join(input.config.runPath, "input", "steering.md"), input.steeringText);
  }
  if (input.behaviorExpectation) {
    await writeFile(
      path.join(input.config.runPath, "input", "behavior.json"),
      `${JSON.stringify(input.behaviorExpectation, null, 2)}\n`,
    );
  }
}

async function writeRawPlaceholders(input: EvidenceInput): Promise<void> {
  const rawDir = path.join(input.config.runPath, "raw");
  const preflight = {
    git: input.preflight.git,
    opencode: input.preflight.opencode,
    stoppedForHumanAction: input.openCode?.stoppedForHumanAction,
  };
  await writeFile(path.join(rawDir, "preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`);

  await writeFile(
    path.join(rawDir, "server.json"),
    `${JSON.stringify(
      input.openCode?.server ?? {
        status: "not tested because precondition missing",
        reason: input.openCode?.stoppedForHumanAction,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(rawDir, "opencode-session.json"),
    `${JSON.stringify(
      {
        status: input.openCode?.session ? "observed" : "not tested because precondition missing",
        reason: input.openCode?.session ? undefined : input.openCode?.stoppedForHumanAction,
        provider: input.openCode?.provider ?? null,
        session: input.openCode?.session ?? null,
        prompt: input.openCode?.prompt ?? null,
        messages: input.openCode?.messages ?? null,
        sessionDiff: input.openCode?.sessionDiff ?? null,
        fileStatus: input.openCode?.fileStatus ?? null,
      },
      null,
      2,
    )}\n`,
  );

  const lines = input.openCode?.events.map((event) => JSON.stringify(event)).join("\n") ?? "";
  await writeFile(path.join(rawDir, "opencode-events.jsonl"), lines ? `${lines}\n` : "");
}

async function writeBehaviorArtifacts(input: EvidenceInput): Promise<void> {
  await writeFile(
    path.join(input.config.runPath, "behavior", "evaluation.json"),
    `${JSON.stringify(
      input.behaviorEvaluation ?? {
        status: "not configured",
        reason: "No behavior.json expectation was provided for this assignment.",
      },
      null,
      2,
    )}\n`,
  );
}

async function writeChangeArtifacts(input: EvidenceInput): Promise<void> {
  await writeFile(path.join(input.config.runPath, "changes", "final.diff"), input.gitDiff.stdout);
  await writeFile(
    path.join(input.config.runPath, "changes", "file-status.json"),
    `${JSON.stringify(
      {
        changedFiles: normalizeNoIndexNameStatus(input.gitStatus.stdout),
        rawGitStatus: input.gitStatus,
        sdkFileStatus: input.openCode?.fileStatus ?? null,
      },
      null,
      2,
    )}\n`,
  );
}

async function writeSummary(input: EvidenceInput): Promise<void> {
  const questions = mergedQuestions(input);
  const lines = [
    "# OpenCode Harness Run Summary",
    "",
    `Run id: \`${input.config.runId}\``,
    `Attempt path: \`${input.config.attemptPath}\``,
    "",
    "## Core Questions",
    "",
    "| Question | Status | Evidence | Detail |",
    "| --- | --- | --- | --- |",
    ...QUESTION_ORDER.map((id) => {
      const result = questions[id];
      return `| ${escapeTable(result.question)} | \`${result.status}\` | \`${result.artifact}\` | ${escapeTable(result.detail)} |`;
    }),
    "",
    "## Checks",
    "",
    `- Before-agent check exit code: \`${input.beforeCheck.result.exitCode}\``,
    input.afterCheck
      ? `- After-agent check exit code: \`${input.afterCheck.result.exitCode}\``
      : "- After-agent check: `not run`",
    "",
    "## Human Action",
    "",
    input.openCode?.stoppedForHumanAction
      ? `Required: ${input.openCode.stoppedForHumanAction}`
      : "None recorded by the harness.",
    "",
    "## Behavior Evaluation",
    "",
    input.behaviorEvaluation
      ? `- Kind: \`${input.behaviorEvaluation.kind}\``
      : "- Kind: `not configured`",
    input.behaviorEvaluation
      ? `- Status: \`${input.behaviorEvaluation.status}\``
      : "- Status: `not configured`",
    ...(input.behaviorEvaluation
      ? input.behaviorEvaluation.checks.map((check) => {
          return `- ${check.passed ? "PASS" : "FAIL"} \`${check.name}\`: ${escapeTable(check.detail)}`;
        })
      : []),
    ...(input.behaviorEvaluation && input.behaviorEvaluation.warnings.length > 0
      ? [
          "",
          "Warnings:",
          ...input.behaviorEvaluation.warnings.map((warning) => {
            return `- \`${warning.name}\`: ${escapeTable(warning.detail)}`;
          }),
        ]
      : []),
    "",
  ];

  await writeFile(path.join(input.config.runPath, "summary.md"), `${lines.join("\n")}\n`);
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function describeSdkFileStatus(fileStatus: unknown): string {
  if (Array.isArray(fileStatus)) {
    return `${fileStatus.length} records`;
  }
  if (fileStatus === undefined || fileStatus === null) {
    return "not available";
  }
  return "available as non-array response";
}

function isNoIndexDiffResult(exitCode: number | null): boolean {
  return exitCode === 0 || exitCode === 1;
}

function describeNoIndexExit(exitCode: number | null): string {
  if (exitCode === 0) {
    return "exit 0 (no differences)";
  }
  if (exitCode === 1) {
    return "exit 1 (differences found)";
  }
  return `exit ${exitCode}`;
}

function normalizeNoIndexNameStatus(stdout: string): Array<{ status: string; path: string }> {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, rawPath] = line.split("\t");
      return {
        status,
        path: rawPath.replace(/^(baseline|attempt)\//, ""),
      };
    });
}
