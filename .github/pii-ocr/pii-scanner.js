// Deterministic PII/secret detector. Pure regex, no dependencies, no network calls.
// Used directly by sanitize.js (the hook entrypoint) and reusable by any future script
// that needs the same detection rules (e.g. a future pre-prompt-pii-scan.js implementation).
'use strict';

// Order matters: more specific patterns (secrets, card numbers) run before the generic
// phone pattern so a card number isn't also flagged as a phone number.
const RULES = [
  { type: 'API_KEY_AWS', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'API_KEY_GITHUB', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { type: 'API_KEY_GENERIC', pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { type: 'BEARER_TOKEN', pattern: /\bBearer\s+[A-Za-z0-9\-_.]{10,}\b/gi },
  {
    type: 'GENERIC_SECRET',
    // key: value / key=value pairs where the key name implies a secret and the value looks non-trivial
    pattern: /\b(?:password|passwd|pwd|api[_-]?key|secret|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?[^\s"',}]{6,}/gi,
  },
  { type: 'CREDIT_CARD', pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,4}\b/g },
  { type: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'EMAIL', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // Separators are optional so this also catches unformatted 10-digit numbers (e.g. "9876543210",
  // common for mobile numbers entered without dashes/spaces), not just delimited ones like
  // "987-654-3210". Fixed-length \d{3}/\d{3}/\d{4} plus \b at both ends means it still won't match
  // a substring inside a longer digit run (a 12+ digit account/tracking number, a 16-digit card
  // number) — \b only lands on a digit/non-digit boundary, so there's no partial match within a
  // longer unbroken run. Trade-off: any exact-10-digit unformatted number now matches, including
  // some non-phone IDs that happen to be 10 digits long — accepted as a false-positive risk worth
  // taking to catch real unformatted phone numbers.
  { type: 'PHONE', pattern: /\b(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
];

/**
 * Scan text for PII/secret patterns.
 * @param {string} text
 * @returns {{ hasPII: boolean, matches: Array<{type: string, value: string, start: number, end: number}> }}
 */
function scanText(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { hasPII: false, matches: [] };
  }

  const claimed = []; // [start, end) ranges already matched by an earlier (higher-priority) rule
  const matches = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = claimed.some(([cs, ce]) => start < ce && end > cs);
      if (!overlaps) {
        matches.push({ type: rule.type, value: m[0], start, end });
        claimed.push([start, end]);
      }
      if (m[0].length === 0) rule.pattern.lastIndex++; // avoid infinite loop on zero-width matches
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return { hasPII: matches.length > 0, matches };
}

/**
 * Redact all matches in text with sequential placeholders, e.g. [REDACTED:EMAIL-1].
 * @param {string} text
 * @param {Array<{type: string, value: string, start: number, end: number}>} matches
 * @returns {{ redactedText: string, redactionMap: Record<string, string> }}
 */
function redactText(text, matches) {
  const counters = {};
  const redactionMap = {};

  // Number placeholders in reading order (ascending start index)...
  const forward = [...matches].sort((a, b) => a.start - b.start);
  const placeholders = forward.map((match) => {
    counters[match.type] = (counters[match.type] || 0) + 1;
    const placeholder = `[REDACTED:${match.type}-${counters[match.type]}]`;
    redactionMap[placeholder] = match.value;
    return { ...match, placeholder };
  });

  // ...but apply the replacements back-to-front so earlier indices stay valid.
  let result = text;
  for (const match of [...placeholders].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, match.start) + match.placeholder + result.slice(match.end);
  }

  return { redactedText: result, redactionMap };
}

module.exports = { scanText, redactText, RULES };
