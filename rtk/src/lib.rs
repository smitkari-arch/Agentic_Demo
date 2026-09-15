//! Core truncation/dedup logic for RTK (Rust Token Killer).
//! Kept independent of stdin/stdout JSON plumbing so it can be unit tested directly.

#[derive(Debug, Clone)]
pub struct Config {
    pub max_lines: usize,
    pub max_chars: usize,
    pub head_lines: usize,
    pub tail_lines: usize,
    pub dedupe_threshold: usize,
    pub max_line_chars: usize,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            max_lines: 300,
            max_chars: 20_000,
            head_lines: 50,
            tail_lines: 50,
            dedupe_threshold: 3,
            max_line_chars: 2_000,
        }
    }
}

impl Config {
    /// Apply overrides from a flat `key = value` config.toml-style text (no external toml
    /// dependency — this repo's hooks favor minimal dependencies, and the format we control
    /// is simple enough to parse by hand).
    pub fn apply_toml_overrides(&mut self, text: &str) {
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');
                if let Ok(n) = value.parse::<usize>() {
                    match key {
                        "max_lines" => self.max_lines = n,
                        "max_chars" => self.max_chars = n,
                        "head_lines" => self.head_lines = n,
                        "tail_lines" => self.tail_lines = n,
                        "dedupe_threshold" => self.dedupe_threshold = n,
                        "max_line_chars" => self.max_line_chars = n,
                        _ => {}
                    }
                }
            }
        }
    }

    /// Apply RTK_* environment variable overrides (highest precedence).
    pub fn apply_env_overrides(&mut self) {
        macro_rules! env_override {
            ($field:expr, $name:expr) => {
                if let Ok(v) = std::env::var($name) {
                    if let Ok(n) = v.parse::<usize>() {
                        $field = n;
                    }
                }
            };
        }
        env_override!(self.max_lines, "RTK_MAX_LINES");
        env_override!(self.max_chars, "RTK_MAX_CHARS");
        env_override!(self.head_lines, "RTK_HEAD_LINES");
        env_override!(self.tail_lines, "RTK_TAIL_LINES");
        env_override!(self.dedupe_threshold, "RTK_DEDUPE_THRESHOLD");
        env_override!(self.max_line_chars, "RTK_MAX_LINE_CHARS");
    }
}

pub struct ProcessResult {
    pub output: String,
    pub truncated: bool,
    pub original_lines: usize,
    pub new_lines: usize,
    pub original_chars: usize,
    pub new_chars: usize,
}

/// Strip ANSI CSI escape sequences (e.g. color codes) — pure noise for the model.
pub fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                while let Some(nc) = chars.next() {
                    if ('\x40'..='\x7e').contains(&nc) {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

/// Lines carrying failure/error signal must never be silently dropped — this repo's testing
/// conventions require real pass/fail evidence, so truncation must not be able to hide it.
pub fn is_signal_line(line: &str) -> bool {
    const KEYWORDS: [&str; 7] = [
        "fail",
        "error",
        "exception",
        "traceback",
        "panicked",
        "✗",
        "✘",
    ];
    let lower = line.to_lowercase();
    KEYWORDS.iter().any(|k| lower.contains(k))
}

fn truncate_long_line(line: &str, max_chars: usize) -> String {
    let total = line.chars().count();
    if total <= max_chars {
        return line.to_string();
    }
    let head: String = line.chars().take(max_chars).collect();
    format!("{head}... [rtk: line truncated, {} more chars]", total - max_chars)
}

/// Collapse runs of 3+ (configurable) identical consecutive lines into one + a repeat marker.
pub fn collapse_duplicates(lines: &[String], threshold: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let cur = &lines[i];
        let mut j = i + 1;
        while j < lines.len() && lines[j] == *cur {
            j += 1;
        }
        let count = j - i;
        if threshold > 0 && count >= threshold {
            out.push(cur.clone());
            out.push(format!(
                "... [rtk: previous line repeated {} more time(s)]",
                count - 1
            ));
        } else {
            out.extend(lines[i..j].iter().cloned());
        }
        i = j;
    }
    out
}

pub fn process(input: &str, config: &Config) -> ProcessResult {
    let original_chars = input.chars().count();
    let original_lines = input.lines().count();

    if original_chars <= config.max_chars && original_lines <= config.max_lines {
        return ProcessResult {
            output: input.to_string(),
            truncated: false,
            original_lines,
            new_lines: original_lines,
            original_chars,
            new_chars: original_chars,
        };
    }

    let stripped = strip_ansi(input);
    let capped_lines: Vec<String> = stripped
        .lines()
        .map(|l| truncate_long_line(l, config.max_line_chars))
        .collect();
    let deduped = collapse_duplicates(&capped_lines, config.dedupe_threshold);

    let final_lines: Vec<String> =
        if deduped.len() > config.max_lines && deduped.len() > config.head_lines + config.tail_lines {
            let head_end = config.head_lines;
            let tail_start = deduped.len() - config.tail_lines;

            let mut merged: Vec<String> = Vec::new();
            merged.extend(deduped[..head_end].iter().cloned());

            let elided_count = tail_start - head_end;
            merged.push(format!("... [rtk: {elided_count} lines elided] ..."));

            let signal_lines: Vec<&String> = deduped[head_end..tail_start]
                .iter()
                .filter(|l| is_signal_line(l))
                .collect();
            if !signal_lines.is_empty() {
                merged.push(format!(
                    "... [rtk: {} signal line(s) retained from elided region] ...",
                    signal_lines.len()
                ));
                for s in signal_lines {
                    merged.push(format!("  ! {s}"));
                }
            }

            merged.extend(deduped[tail_start..].iter().cloned());
            merged
        } else {
            deduped
        };

    let mut output = final_lines.join("\n");
    let new_chars = output.chars().count();
    let truncated = final_lines.len() != original_lines || new_chars != original_chars;

    if truncated {
        output.push_str(&format!(
            "\n[rtk: reduced {original_lines} lines/{original_chars} chars -> {} lines/{new_chars} chars]",
            final_lines.len()
        ));
    }

    let final_new_chars = output.chars().count();
    ProcessResult {
        output,
        truncated,
        original_lines,
        new_lines: final_lines.len(),
        original_chars,
        new_chars: final_new_chars,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_config() -> Config {
        Config {
            max_lines: 10,
            max_chars: 500,
            head_lines: 2,
            tail_lines: 2,
            dedupe_threshold: 3,
            max_line_chars: 100,
        }
    }

    #[test]
    fn small_input_passes_through_unchanged() {
        let input = "line1\nline2\nline3";
        let result = process(input, &Config::default());
        assert!(!result.truncated);
        assert_eq!(result.output, input);
    }

    #[test]
    fn collapses_three_or_more_duplicate_lines() {
        let lines: Vec<String> = vec!["dup".to_string(); 5];
        let collapsed = collapse_duplicates(&lines, 3);
        assert_eq!(collapsed, vec!["dup", "... [rtk: previous line repeated 4 more time(s)]"]);
    }

    #[test]
    fn leaves_short_runs_of_duplicates_alone() {
        let lines: Vec<String> = vec!["dup".to_string(); 2];
        let collapsed = collapse_duplicates(&lines, 3);
        assert_eq!(collapsed, vec!["dup", "dup"]);
    }

    #[test]
    fn strips_ansi_color_codes() {
        let input = "\u{1b}[31mred text\u{1b}[0m plain";
        assert_eq!(strip_ansi(input), "red text plain");
    }

    #[test]
    fn structural_truncation_keeps_head_and_tail() {
        let config = tiny_config();
        let body: Vec<String> = (0..30).map(|i| format!("line{i}")).collect();
        let input = body.join("\n");
        let result = process(&input, &config);
        assert!(result.truncated);
        assert!(result.output.contains("line0"));
        assert!(result.output.contains("line1"));
        assert!(result.output.contains("line29"));
        assert!(result.output.contains("lines elided"));
    }

    #[test]
    fn structural_truncation_never_drops_signal_lines() {
        let config = tiny_config();
        let mut body: Vec<String> = (0..30).map(|i| format!("line{i}")).collect();
        body[15] = "FAIL: something broke".to_string();
        let input = body.join("\n");
        let result = process(&input, &config);
        assert!(result.truncated);
        assert!(
            result.output.contains("FAIL: something broke"),
            "signal line must survive truncation: {}",
            result.output
        );
    }

    #[test]
    fn truncates_individual_overlong_lines() {
        let config = tiny_config();
        let long_line = "x".repeat(1000);
        let input = format!("short\n{long_line}\nshort2");
        // Force the char threshold to trigger by itself even with few lines.
        let mut config = config;
        config.max_chars = 50;
        let result = process(&input, &config);
        assert!(result.truncated);
        assert!(result.output.contains("line truncated"));
    }

    #[test]
    fn toml_overrides_apply_expected_fields() {
        let mut config = Config::default();
        config.apply_toml_overrides("max_lines = 42\nmax_chars = 999\n# comment\nbogus = 1\n");
        assert_eq!(config.max_lines, 42);
        assert_eq!(config.max_chars, 999);
    }
}
