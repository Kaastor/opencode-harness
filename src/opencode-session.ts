import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk";
import type { ServerOptions } from "@opencode-ai/sdk";
import { runCommand } from "./command.js";
import { questionResult } from "./questions.js";
import type { QuestionStatus } from "./types.js";
import type { HarnessConfig, OpenCodeRunResult } from "./types.js";

export async function checkOpenCodeBinary(repoRoot: string) {
  return runCommand("opencode", ["--version"], repoRoot);
}

export async function runOpenCodeSession(
  config: HarnessConfig,
  taskText: string,
): Promise<OpenCodeRunResult> {
  const events: Array<unknown> = [];
  const questions: OpenCodeRunResult["questions"] = {};
  let serverHandle: Awaited<ReturnType<typeof createOpencodeServer>> | undefined;

  const serverOptions: ServerOptions = {
    hostname: "127.0.0.1",
    port: 4096,
    timeout: 5000,
    config: {
      autoupdate: false,
      logLevel: "ERROR",
      share: "disabled",
    },
  };

  try {
    serverHandle = await createOpencodeServer(serverOptions);
    const server = { url: serverHandle.url, options: serverOptions };
    questions.server = questionResult("server", "observed", `Connected to ${serverHandle.url}.`);

    const client = createOpencodeClient({
      baseUrl: serverHandle.url,
      directory: config.attemptPath,
    });

    const provider = await client.provider.list();
    const connectedProviders =
      provider.data && "connected" in provider.data ? provider.data.connected : [];

    if (!provider.data || connectedProviders.length === 0) {
      questions["provider-auth"] = questionResult(
        "provider-auth",
        "not tested because precondition missing",
        "OpenCode server started, but no connected provider was reported. User must configure local OpenCode provider auth.",
      );
      return {
        server,
        provider: provider.data ?? provider.error,
        events,
        questions,
        stoppedForHumanAction: "Configure local OpenCode provider auth, then rerun the harness.",
      };
    }

    questions["provider-auth"] = questionResult(
      "provider-auth",
      "observed",
      `OpenCode reported connected providers: ${connectedProviders.join(", ")}. Harness did not read or store credentials.`,
    );

    const session = await client.session.create({
      query: { directory: config.attemptPath },
      body: { title: "opencode-harness tiny assignment" },
    });
    if (!session.data) {
      questions.session = questionResult(
        "session",
        "failed",
        `Session create returned no data: ${JSON.stringify(session.error)}`,
      );
      return { server, provider: provider.data, session: session.error, events, questions };
    }

    questions.session = questionResult("session", "observed", `Created session ${session.data.id}.`);
    questions.workspace = questionResult(
      "workspace",
      session.data.directory === config.attemptPath ? "observed" : "failed",
      `Session directory: ${session.data.directory}; expected attempt path: ${config.attemptPath}.`,
    );

    const promptText = buildTaskPrompt(taskText);
    const prompt = await client.session.prompt({
      path: { id: session.data.id },
      query: { directory: config.attemptPath },
      body: {
        parts: [{ type: "text", text: promptText }],
      },
    });

    if (!prompt.data) {
      questions["task-message"] = questionResult(
        "task-message",
        "failed",
        `Prompt returned no data: ${JSON.stringify(prompt.error)}`,
      );
      return { server, provider: provider.data, session: session.data, prompt: prompt.error, events, questions };
    }

    questions["task-message"] = questionResult(
      "task-message",
      "observed",
      `Prompt returned assistant message ${prompt.data.info.id}.`,
    );

    const [messages, sessionDiff, fileStatus] = await Promise.all([
      client.session.messages({
        path: { id: session.data.id },
        query: { directory: config.attemptPath, limit: 50 },
      }),
      client.session.diff({
        path: { id: session.data.id },
        query: { directory: config.attemptPath },
      }),
      client.file.status({
        query: { directory: config.attemptPath },
      }),
    ]);

    questions.state = questionResult(
      "state",
      messages.data && messages.data.length > 0 ? "observed" : "failed",
      messages.data ? `Captured ${messages.data.length} session message records.` : "No session messages captured.",
    );
    questions["diff-status"] = questionResult(
      "diff-status",
      fileStatus.data ? "observed" : "failed",
      fileStatus.data ? `Captured ${fileStatus.data.length} file status records.` : "No file status captured.",
    );

    return {
      server,
      provider: provider.data,
      session: session.data,
      prompt: prompt.data,
      messages: messages.data ?? messages.error,
      sessionDiff: sessionDiff.data ?? sessionDiff.error,
      fileStatus: fileStatus.data ?? fileStatus.error,
      events,
      questions,
    };
  } catch (error) {
    const classified = classifyOpenCodeError(error);
    questions.server = questionResult(
      "server",
      classified.status,
      classified.message,
    );
    return {
      events,
      questions,
      stoppedForHumanAction: classified.humanAction,
    };
  } finally {
    serverHandle?.close();
  }
}

function buildTaskPrompt(taskText: string): string {
  return [
    "You are running inside the opencode-harness behavior-loop probe.",
    "Work only in the current assignment attempt directory.",
    "Fix the task described below with the smallest useful code change.",
    "Do not modify check files.",
    "",
    taskText,
  ].join("\n");
}

function classifyOpenCodeError(error: unknown): {
  status: QuestionStatus;
  message: string;
  humanAction?: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ENOENT") || message.includes("spawn opencode")) {
    return {
      status: "not tested because precondition missing",
      message,
      humanAction: "Install OpenCode and configure local provider auth, then rerun the harness.",
    };
  }
  return {
    status: "failed",
    message,
  };
}
