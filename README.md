# opencode-harness

This repository probes whether OpenCode can be used as a local,
user-authenticated coding-agent runtime underneath a custom harness.

The focus is the OpenCode SDK/server path, not CLI wrapping.

This is an experiment, not an education product. It does not attempt to prove
learning, detect cheating, grade students, or build a full lab platform. The
first question is narrower:

```text
Can a small outer tool control an OpenCode session, target a workspace,
observe useful state, run deterministic checks, and package local evidence
without handling provider credentials?
```

## Why This Exists

Future learning or workshop tools may need a local coding-agent harness where:

- the assignment workspace is prepared by an outer tool
- the student uses their own local provider setup
- the agent work is observable enough to inspect later
- deterministic checks can run after the agent finishes
- the result is an evidence bundle, not a claim of independent mastery

OpenCode may be a useful substrate because it exposes a local server, SDK, agent
sessions, provider configuration, permissions, and session state. This
repository exists to validate that assumption before building product features
on top of it.

## Non-Goals

This repository does not try to:

- build a teacher dashboard
- implement a rubric engine
- create a grading or assessment system
- prove concept transfer or unaided student work
- support every model provider or consumer subscription
- compare OpenCode with every other coding agent
- create a generic provider abstraction

## Experiment Shape

The intended probe is:

```text
student/developer runs harness
-> harness prepares a tiny assignment workspace
-> harness connects to OpenCode through SDK/server
-> harness sends one task message
-> OpenCode works using local provider auth
-> harness collects session state, events, diff, and checks
-> harness writes an evidence bundle
```

See [docs/plan.md](docs/plan.md) for the scoped experiment plan.

## Status

Planning only. No implementation yet.
