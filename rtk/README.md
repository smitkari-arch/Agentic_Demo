# RTK (Rust Token Killer)

**Status: implemented.** This is the real, self-contained Rust project for terminal-output truncation, following the same pattern as `playwrightTests/` (its own `package.json` and local output) with its own `Cargo.toml` and `target/` directory.

## What it does

RTK is the backend for a GitHub Copilot `PostToolUse` hook (`.github/hooks/rtk-truncate.json`, running `.github/scripts/post-tool-rtk.truncate.js`) registered on terminal tool calls. When a shell command's output is large, RTK truncates/dedupes it before it reaches the model's context — cutting token consumption in CLI-heavy sessions without losing pass/fail signal.

Small output (below the configured thresholds) is passed through completely unchanged — RTK only does work when there's actually something worth shrinking.

## Contents

- `src/lib.rs` — the actual truncation/dedup logic (`process()`), unit-testable independent of stdin/stdout plumbing. Run `cargo test` to exercise it.
- `src/main.rs` — reads a GitHub Copilot hook payload JSON from stdin, calls into `lib.rs`, writes the `hookSpecificOutput` JSON contract back to stdout. Fails open (`{}`, no change) on any parse error or non-matching payload.
- `config.toml` — default thresholds (`max_lines`, `max_chars`, `head_lines`, `tail_lines`, `dedupe_threshold`, `max_line_chars`). Overridable per-run via `RTK_*` environment variables without a rebuild.

## Reduction policy

1. Strip ANSI color escape codes (pure noise for the model).
2. Collapse 3+ identical consecutive lines into one + a `(repeated Nx)` marker.
3. Truncate any single absurdly long line.
4. If still over the line-count threshold: keep the first ~50 and last ~50 lines, elide the middle with a `[rtk: N lines elided]` marker.
5. **Safety override**: lines matching a failure/error keyword list (`fail`, `error`, `exception`, `traceback`, `panicked`, `✗`, `✘`) are always retained even if they fall inside the elided region — this repo's testing conventions ([copilot-instructions.md](../.github/copilot-instructions.md#testing-conventions)) require real pass/fail evidence, so truncation must never be able to hide it.
6. A trailer line is appended whenever anything was reduced, stating original vs. new line/char counts, so it's obvious to the model/user that output was shrunk.

No audit logging is included by design — logging every truncation would add overhead counter to the tool's own purpose.

## Building

```
cargo build --release
cargo test
```

The Node wrapper hook looks for the compiled binary at `target/release/rtk.exe` (Windows) / `target/release/rtk` (other platforms) relative to this folder, and fails open (no-op) if it hasn't been built yet.

## See also

- [.github/hooks/rtk-truncate.json](../.github/hooks/rtk-truncate.json) — the hook registration.
- [.github/scripts/post-tool-rtk.truncate.js](../.github/scripts/post-tool-rtk.truncate.js) — the hook script this binary is invoked from.
