# Project governance memory (distinct from Copilot's personal auto-memory)

This folder is the **project-committed** knowledge/memory layer of this repo's governance model ("Knowledge & Memory Layer" — approved static KB, sprint context, decision log, execution history, failure learning). It's checked into this repo and shared by anyone working on it.

**This is a different system from VS Code Copilot's personal cross-session memory** (stored outside this repo, under the user's own per-user memory storage, and scoped to one person's conversations across projects/workspaces). Do not confuse the two:

| | This folder (`.github/memory/`) | Personal memory |
|---|---|---|
| Scope | This repo, shared by whoever works on it | One user, across all their projects |
| Storage | Committed to the repo (once git is initialized) | Outside the repo, per-user |
| Written by | Explicit human decisions (see files below) | The assistant, automatically, across conversations |
| Purpose | Approved domain/app/framework context, decision history | User preferences, feedback, project context for that user |

## Files
- [approved-static-context.md](approved-static-context.md) — approved domain/app/API-spec/automation-standards context agents may rely on without re-deriving it each time.
- [decision-log.md](decision-log.md) — human-approved decisions and exceptions, with dates.

**Status:** Phase 1 scaffold. Per [instructions/phase1-scope.instructions.md](../instructions/phase1-scope.instructions.md), agents do not write to this folder autonomously — updates here are a human action, same as repository check-in.
