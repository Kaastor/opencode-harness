# opencode-harness

This repository probes whether OpenCode can be used as a local,
user-authenticated coding-agent runtime under a custom harness.

The focus is the OpenCode SDK/server path, not CLI wrapping. This is an
experiment, not an education product. The core question is:

```text
Can a small outer tool control an OpenCode session, target an attempt directory,
observe useful session state, run deterministic checks, and package local evidence
without handling provider credentials?
```

## Scope

The probe is scoped to:

- prepare a tiny assignment attempt
- connect to OpenCode through SDK/server
- send one task message
- rely on local OpenCode provider auth
- collect session messages/state, diffs, and check results
- write an evidence bundle

Out of scope:

- teacher dashboard or rubric engine
- grading, cheating detection, or assessment claims
- proof of concept transfer or unaided work
- universal provider/subscription support
- Codex comparison or generic provider abstraction

## Status

Initial behavior-loop CLI is present and has completed a real OpenCode SDK run
on the tiny fixture. The useful trace is currently session messages/state, git
diff/status, and check results. Streamed event capture is optional future work,
not the core proof. See [docs/plan.md](docs/plan.md).

Verified slice:

```text
local harness -> OpenCode SDK/server -> assignment attempt -> evidence bundle
```

Not verified here: provider portability, teacher dashboards, rubric gates,
cheating resistance, or proof of independent understanding.

## Attempt Review Probe

The harness also includes a behavior probe for review-before-retry feedback:

```bash
npm run harness -- run examples/attempt-review-assignment
```

This probe does not try to prevent the model from knowing the solution. It tests
whether the harness can steer OpenCode into reviewing a student's current
attempt, leaving files unchanged, keeping the failing check failing, and writing
feedback/evidence/retry signals into the run bundle.
