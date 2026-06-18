import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./command.js";
import type { CheckRun } from "./types.js";

export async function runAssignmentCheck(
  phase: "before-agent" | "after-agent",
  checkScriptPath: string,
  attemptPath: string,
): Promise<CheckRun> {
  return {
    name: "tiny-assignment-check",
    phase,
    result: await runCommand("bash", [checkScriptPath], attemptPath),
  };
}

export async function writeCheckArtifacts(runPath: string, checks: CheckRun[]): Promise<void> {
  await writeFile(
    path.join(runPath, "checks", "checks.json"),
    `${JSON.stringify(checks, null, 2)}\n`,
  );
  const output = checks
    .map((check) => {
      return [
        `# ${check.name} (${check.phase})`,
        `$ ${check.result.command}`,
        `exit: ${check.result.exitCode}`,
        "stdout:",
        check.result.stdout || "<empty>",
        "stderr:",
        check.result.stderr || "<empty>",
      ].join("\n");
    })
    .join("\n\n");
  await writeFile(path.join(runPath, "checks", "test-output.txt"), `${output}\n`);
}
