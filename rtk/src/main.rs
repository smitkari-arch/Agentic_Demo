//! RTK (Rust Token Killer) — GitHub Copilot `PostToolUse` hook backend.
//!
//! Reads the hook payload JSON from stdin, and if it's a terminal tool call whose
//! output exceeds the configured thresholds, writes back a `hookSpecificOutput.updatedToolOutput`
//! JSON response that replaces the tool output with a truncated/deduped version. Fails open
//! (emits `{}`, i.e. no change) on any parse error or non-matching payload, so a bug here can
//! never break the tool pipeline — mirrors the fail-open convention used by this repo's existing
//! `.github/pii-ocr/sanitize.js` hooks.

use std::io::{self, Read, Write};

use rtk::Config;
use serde_json::Value;

fn load_config() -> Config {
    let mut config = Config::default();

    for path in ["rtk/config.toml", "config.toml"] {
        if let Ok(text) = std::fs::read_to_string(path) {
            config.apply_toml_overrides(&text);
            break;
        }
    }

    config.apply_env_overrides();
    config
}

fn no_op() -> Value {
    serde_json::json!({ "hookSpecificOutput": { "hookEventName": "PostToolUse" } })
}

fn main() {
    let mut input = String::new();
    if io::stdin().read_to_string(&mut input).is_err() {
        print!("{}", no_op());
        return;
    }

    let response = match handle(&input) {
        Some(v) => v,
        None => no_op(),
    };

    let _ = io::stdout().write_all(response.to_string().as_bytes());
}

fn handle(input: &str) -> Option<Value> {
    let payload: Value = serde_json::from_str(input).ok()?;

    if payload.get("hook_event_name")?.as_str()? != "PostToolUse" {
        return None;
    }
    let tool_name = payload.get("tool_name")?.as_str()?;
    if tool_name != "Bash" && tool_name != "PowerShell" {
        return None;
    }

    // Bash/PowerShell PostToolUse payloads nest output under tool_response.{stdout,stderr},
    // not a top-level tool_output — confirmed against a real hook payload captured from a live
    // Bash call (a top-level `tool_output` key does not exist for this tool_name pair).
    let tool_response = payload.get("tool_response")?;
    let output_text = match tool_response.get("stdout").and_then(Value::as_str) {
        Some(stdout) => {
            let stderr = tool_response.get("stderr").and_then(Value::as_str).unwrap_or("");
            if stderr.is_empty() {
                stdout.to_string()
            } else {
                format!("{stdout}\n{stderr}")
            }
        }
        None => return None,
    };

    let config = load_config();
    let result = rtk::process(&output_text, &config);

    if !result.truncated {
        return None;
    }

    Some(serde_json::json!({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "updatedToolOutput": result.output,
        }
    }))
}
