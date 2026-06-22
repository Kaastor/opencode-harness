# opencode-harness

This repository probes whether local, user-authenticated coding-agent runtimes
can be wrapped by a custom harness.

The first probe uses the OpenCode SDK/server path. The second probe uses the Pi
SDK. This is an experiment, not an education product. The core question is:

```text
Can a small outer tool control an agent session, target an attempt directory,
observe useful session state, run deterministic checks, and package local evidence
without handling provider credentials?
```

## Scope

The probe is scoped to:

- prepare a tiny assignment attempt
- connect to a local agent runtime through SDK/server APIs
- send one task message
- rely on runtime-owned local provider auth
- collect session messages/state, diffs, and check results
- write an evidence bundle

Out of scope:

- teacher dashboard or rubric engine
- grading, cheating detection, or assessment claims
- proof of concept transfer or unaided work
- universal provider/subscription support
- Codex comparison or full generic provider abstraction

## Status

Initial behavior-loop CLI is present and has completed a real OpenCode SDK run
on the tiny fixture. A Pi SDK probe is also present so the same assignment/check
loop can test a second runtime. The useful trace is currently session
messages/state, git diff/status, and check results. Streamed event capture is
optional future work, not the core proof. See [docs/plan.md](docs/plan.md).

Verified slice:

```text
local harness -> runtime SDK/server -> assignment attempt -> evidence bundle
```

Not verified here: provider portability, teacher dashboards, rubric gates,
cheating resistance, or proof of independent understanding.

## How To Run It

Mental model:

```text
you
-> opencode-harness CLI
-> OpenCode SDK/server or Pi SDK
-> copied assignment attempt in runs/<run-id>/attempt
-> evidence bundle in runs/<run-id>/
```

The harness does not ask for provider keys. The selected runtime owns provider
login on your machine. The harness only asks the runtime to work inside a
prepared attempt directory and then records evidence.

### 1. Open the repository

```bash
git clone https://github.com/Kaastor/opencode-harness.git
cd opencode-harness
```

If you already have the repository locally, just `cd` into that local checkout.

### 2. Install Node dependencies

```bash
npm install
```

This installs the TypeScript tooling, `@opencode-ai/sdk`, and
`@earendil-works/pi-coding-agent` used by the local harness probes.

### 3. Check that OpenCode is available

```bash
opencode --version
```

If this command is missing, install OpenCode first. The harness calls the
OpenCode SDK/server path, but it still expects OpenCode to be available locally.

### 4. Check OpenCode provider auth

```bash
opencode auth list
```

This shows credentials stored in OpenCode's local auth file. It can be empty
even when OpenCode still has a runnable default/provider path available in your
environment.

If no provider works when you run the harness, log in through OpenCode:

```bash
opencode auth login
```

The exact provider flow depends on your OpenCode setup. Keep credentials in
OpenCode; do not put provider keys into this repository. The harness proof is
the run summary, not the auth-list output.

### 5. Run the basic OpenCode SDK harness probe

```bash
npm run harness -- run examples/tiny-assignment
```

This creates a fresh run directory, copies the starter assignment into an
editable attempt, asks OpenCode to work on that attempt, runs the check, and
writes an evidence bundle.

The command prints something like:

```text
run_id=2026-06-22T20-45-38-632Z
summary=/Users/.../opencode-harness/runs/2026-06-22T20-45-38-632Z/summary.md
```

Open the printed `summary.md` first. It tells you which control points were
observed, failed, unsupported, or skipped because a precondition was missing.

### 6. Run the Pi SDK harness probe

Pi is tested through its SDK, not by wrapping the Pi CLI.

```bash
npm run harness -- run-pi examples/tiny-assignment
```

If Pi has no locally authenticated model, the harness stops and writes an
evidence bundle saying human action is required. Configure Pi provider auth in
Pi itself, then rerun the command. The harness should not receive raw provider
keys.

Inspect:

```text
runs/<run-id>/summary.md
runs/<run-id>/raw/pi-session.json
runs/<run-id>/raw/pi-events.jsonl
runs/<run-id>/changes/file-status.json
```

### 7. Run the attempt-review behavior probe

```bash
npm run harness -- run examples/attempt-review-assignment
npm run harness -- run-pi examples/attempt-review-assignment
```

This probe asks the runtime to review a failing student attempt instead of
fixing it. The expected behavior is:

- The runtime may inspect files and checks.
- The runtime should not edit, write, or patch files.
- The check should remain failing because the student still owns the retry.
- The visible answer should contain feedback, evidence, and a retry signal.

Inspect:

```text
runs/<run-id>/summary.md
runs/<run-id>/behavior/evaluation.json
runs/<run-id>/changes/file-status.json
runs/<run-id>/raw/opencode-session.json
runs/<run-id>/raw/pi-session.json
```

### 8. Optional checks while developing

```bash
npm run typecheck
npm run build
```

Use these after changing TypeScript code. They do not replace a real harness
run, because the experiment is about runtime behavior and the produced evidence
bundle.
