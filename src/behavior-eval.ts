import type { BehaviorEvaluation, BehaviorExpectation, CheckRun, OpenCodeRunResult } from "./types.js";
import type { CommandResult } from "./command.js";

export function evaluateBehavior(input: {
  expectation: BehaviorExpectation;
  openCode?: OpenCodeRunResult;
  gitStatus: CommandResult;
  afterCheck?: CheckRun;
}): BehaviorEvaluation {
  const studentVisibleText = extractAssistantText(input.openCode?.messages, ["text"]);
  const rawAssistantText = extractAssistantText(input.openCode?.messages, ["text", "reasoning"]);
  const toolUses = extractToolUses(input.openCode?.messages);
  const checks = [];
  const warnings = [];

  if (input.expectation.expectedNoFileChanges) {
    checks.push({
      name: "no_file_changes",
      passed: input.gitStatus.stdout.trim().length === 0,
      detail: input.gitStatus.stdout.trim() || "No changed files detected.",
    });
  }

  if (input.expectation.expectedCheckToRemainFailing) {
    checks.push({
      name: "check_remained_failing",
      passed: input.afterCheck?.result.exitCode !== 0,
      detail: `after-agent check exit code: ${input.afterCheck?.result.exitCode ?? "not run"}`,
    });
  }

  for (const forbiddenTool of input.expectation.forbiddenToolUse ?? []) {
    const usedForbiddenTool = toolUses.some((tool) => tool.toLowerCase().includes(forbiddenTool.toLowerCase()));
    checks.push({
      name: `forbidden_tool:${forbiddenTool}`,
      passed: !usedForbiddenTool,
      detail: usedForbiddenTool
        ? `tools used: ${toolUses.join(", ")}`
        : `tool use did not include ${JSON.stringify(forbiddenTool)}`,
    });
  }

  for (const group of input.expectation.requiredVisibleTextGroups ?? []) {
    const matched = group.any.filter((text) => studentVisibleText.toLowerCase().includes(text.toLowerCase()));
    checks.push({
      name: `required_visible_text:${group.name}`,
      passed: matched.length > 0,
      detail: matched.length > 0
        ? `matched: ${matched.join(", ")}`
        : `no required terms found: ${group.any.join(", ")}`,
    });
  }

  if (toolUses.length === 0) {
    warnings.push({
      name: "no_tool_use",
      detail: "Review completed without tool use; feedback may be based only on prompt context.",
    });
  }

  return {
    kind: input.expectation.kind,
    status: checks.every((check) => check.passed) ? "observed" : "failed",
    checks,
    warnings,
    studentVisibleText,
    rawAssistantText,
  };
}

function extractAssistantText(messages: unknown, partTypes: Array<string>): string {
  if (!Array.isArray(messages)) {
    return "";
  }

  return messages
    .filter((message) => {
      return message && typeof message === "object" && "info" in message
        && typeof message.info === "object"
        && message.info !== null
        && "role" in message.info
        && message.info.role === "assistant";
    })
    .flatMap((message) => {
      if (!("parts" in message) || !Array.isArray(message.parts)) {
        return [];
      }
      const parts: Array<unknown> = message.parts;
      return parts
        .filter((part) => hasTextPart(part, partTypes))
        .map((part) => part.text);
    })
    .join("\n\n");
}

function extractToolUses(messages: unknown): Array<string> {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.flatMap((message) => {
    if (!isAssistantMessage(message) || !("parts" in message) || !Array.isArray(message.parts)) {
      return [];
    }
    const parts: Array<unknown> = message.parts;
    return parts
      .filter(hasToolPart)
      .map((part) => part.tool);
  });
}

function isAssistantMessage(message: unknown): message is { info: { role: string }; parts?: Array<unknown> } {
  return message !== null
    && typeof message === "object"
    && "info" in message
    && typeof message.info === "object"
    && message.info !== null
    && "role" in message.info
    && message.info.role === "assistant";
}

function hasTextPart(part: unknown, partTypes: Array<string>): part is { text: string } {
  return part !== null
    && typeof part === "object"
    && "type" in part
    && typeof part.type === "string"
    && partTypes.includes(part.type)
    && "text" in part
    && typeof part.text === "string";
}

function hasToolPart(part: unknown): part is { tool: string } {
  return part !== null
    && typeof part === "object"
    && "type" in part
    && part.type === "tool"
    && "tool" in part
    && typeof part.tool === "string";
}
