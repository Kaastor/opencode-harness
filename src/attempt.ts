import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./command.js";
import type { BehaviorExpectation, HarnessConfig } from "./types.js";

export async function prepareAttempt(
  assignmentPath: string,
  repoRoot: string,
): Promise<{
  config: HarnessConfig;
  taskText: string;
  steeringText?: string;
  behaviorExpectation?: BehaviorExpectation;
}> {
  const resolvedAssignment = path.resolve(repoRoot, assignmentPath);
  const taskPath = path.join(resolvedAssignment, "task.md");
  const starterPath = path.join(resolvedAssignment, "starter");
  const checksPath = path.join(resolvedAssignment, "checks", "check.sh");
  const steeringPath = path.join(resolvedAssignment, "steering.md");
  const behaviorPath = path.join(resolvedAssignment, "behavior.json");
  const taskText = await readFile(taskPath, "utf8");
  const steeringText = existsSync(steeringPath) ? await readFile(steeringPath, "utf8") : undefined;
  const behaviorExpectation = existsSync(behaviorPath)
    ? JSON.parse(await readFile(behaviorPath, "utf8")) as BehaviorExpectation
    : undefined;

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runPath = path.join(repoRoot, "runs", runId);
  const baselinePath = path.join(runPath, "baseline");
  const attemptPath = path.join(runPath, "attempt");

  await mkdir(path.join(runPath, "input"), { recursive: true });
  await mkdir(path.join(runPath, "raw"), { recursive: true });
  await mkdir(path.join(runPath, "changes"), { recursive: true });
  await mkdir(baselinePath, { recursive: true });
  await mkdir(attemptPath, { recursive: true });
  await mkdir(path.join(runPath, "checks"), { recursive: true });

  await cp(starterPath, baselinePath, { recursive: true });
  await cp(starterPath, attemptPath, { recursive: true });
  await writeFile(path.join(runPath, "input", "task.md"), taskText);

  const config: HarnessConfig = {
    assignmentPath: resolvedAssignment,
    taskPath,
    starterPath,
    checksPath,
    steeringPath: steeringText ? steeringPath : undefined,
    behaviorPath: behaviorExpectation ? behaviorPath : undefined,
    baselinePath,
    attemptPath,
    runId,
    runPath,
  };

  await writeFile(
    path.join(runPath, "input", "harness-config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
  await writeFile(
    path.join(runPath, "input", "attempt.json"),
    `${JSON.stringify({ attemptPath, assignmentPath: resolvedAssignment }, null, 2)}\n`,
  );

  return { config, taskText, steeringText, behaviorExpectation };
}

export async function collectAttemptEvidence(runPath: string) {
  const diffArgs = ["diff", "--no-index", "--", "baseline", "attempt"];
  const statusArgs = ["diff", "--no-index", "--name-status", "--", "baseline", "attempt"];
  const gitDiff = await runCommand("git", diffArgs, runPath);
  const gitStatus = await runCommand("git", statusArgs, runPath);
  return { gitDiff, gitStatus };
}
