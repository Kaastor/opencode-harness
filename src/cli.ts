#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./command.js";
import { runAssignmentCheck, writeCheckArtifacts } from "./checks.js";
import { writeEvidenceBundle } from "./evidence.js";
import { evaluateBehavior } from "./behavior-eval.js";
import { checkOpenCodeBinary, runOpenCodeSession } from "./opencode-session.js";
import { baseQuestionResults, questionResult } from "./questions.js";
import { collectAttemptEvidence, prepareAttempt } from "./attempt.js";
import type { CoreQuestionId, CoreQuestionResult, OpenCodeRunResult } from "./types.js";

async function main(): Promise<void> {
  const [command, assignmentPath] = process.argv.slice(2);
  if (command !== "run" || !assignmentPath) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const repoRoot = process.cwd();
  const assignment = path.resolve(repoRoot, assignmentPath);
  validateAssignmentShape(assignment);

  await mkdir(path.join(repoRoot, "runs"), { recursive: true });
  const { config, taskText, steeringText, behaviorExpectation } = await prepareAttempt(assignment, repoRoot);

  const git = await runCommand("git", ["--version"], repoRoot);
  const opencode = await checkOpenCodeBinary(repoRoot);
  const beforeCheck = await runAssignmentCheck("before-agent", config.checksPath, config.attemptPath);

  let openCode: OpenCodeRunResult | undefined;
  let questions: Record<CoreQuestionId, CoreQuestionResult> = baseQuestionResults(
    "OpenCode SDK behavior run has not completed.",
  );

  if (git.exitCode !== 0) {
    questions = markPreconditionMissing("git is required to compare and inspect the attempt.");
  } else if (beforeCheck.result.exitCode === 0) {
    questions = markPreconditionMissing("Fixture check passed before agent work; expected a failing check.");
  } else if (opencode.exitCode !== 0) {
    openCode = {
      events: [],
      questions: {
        server: questionResult(
          "server",
          "not tested because precondition missing",
          opencode.error ?? `opencode --version exited with ${opencode.exitCode}.`,
        ),
      },
      stoppedForHumanAction: "Install OpenCode and configure local provider auth, then rerun the harness.",
    };
    questions = markPreconditionMissing("OpenCode CLI is not available.");
  } else {
    openCode = await runOpenCodeSession(config, taskText, steeringText);
    if (openCode.questions) {
      questions = { ...questions, ...openCode.questions };
    }
  }

  const afterCheck = openCode?.session
    ? await runAssignmentCheck("after-agent", config.checksPath, config.attemptPath)
    : undefined;
  const { gitDiff, gitStatus } = await collectAttemptEvidence(config.runPath);
  const behaviorEvaluation = behaviorExpectation
    ? evaluateBehavior({
        expectation: behaviorExpectation,
        openCode,
        gitStatus,
        afterCheck,
      })
    : undefined;
  await writeCheckArtifacts(config.runPath, afterCheck ? [beforeCheck, afterCheck] : [beforeCheck]);
  await writeEvidenceBundle({
    config,
    taskText,
    steeringText,
    behaviorExpectation,
    behaviorEvaluation,
    preflight: { git, opencode },
    beforeCheck,
    afterCheck,
    gitDiff,
    gitStatus,
    openCode,
    questions,
  });

  console.log(`run_id=${config.runId}`);
  console.log(`summary=${path.join(config.runPath, "summary.md")}`);
  if (openCode?.stoppedForHumanAction) {
    console.log(`human_action_required=${openCode.stoppedForHumanAction}`);
    process.exitCode = 3;
  }
}

function validateAssignmentShape(assignment: string): void {
  const required = [
    path.join(assignment, "task.md"),
    path.join(assignment, "starter"),
    path.join(assignment, "checks", "check.sh"),
  ];
  const missing = required.filter((item) => !existsSync(item));
  if (missing.length > 0) {
    throw new Error(`Assignment is missing required files:\n${missing.join("\n")}`);
  }
}

function markPreconditionMissing(reason: string): Record<CoreQuestionId, CoreQuestionResult> {
  return baseQuestionResults(reason);
}

function printUsage(): void {
  console.error("Usage: opencode-harness run <assignment-path>");
  console.error("Example: npm run harness -- run examples/tiny-assignment");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
