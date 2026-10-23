export type SecretSeverity = 'high' | 'medium';
export interface SecretFinding { kind: string; severity: SecretSeverity; location: string; preview: string; start: number; end: number; value: string }
const rules: Array<{ kind: string; severity: SecretSeverity; regex: RegExp }> = [
  { kind: 'OpenAI-style API key', severity: 'high', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g },
  { kind: 'GitHub personal access token', severity: 'high', regex: /\bghp_[A-Za-z0-9]{20,}\b/g },
  { kind: 'GitHub fine-grained token', severity: 'high', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { kind: 'Bearer token', severity: 'high', regex: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi },
  { kind: 'AWS access key ID', severity: 'high', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'Credential assignment', severity: 'medium', regex: /(?:api[_-]?key|secret|password|passwd|token|database_url|db_url)\s*["']?\s*[:=]\s*["']([^\s"']{6,})["']/gi },
  { kind: 'Private key block', severity: 'high', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{12,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];
export function scanSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of text.matchAll(rule.regex)) {
      const full = match[0];
      const value = match[1] ?? full;
      const offset = match.index ?? 0;
      const start = match[1] ? offset + full.indexOf(value) : offset;
      findings.push({ kind: rule.kind, severity: rule.severity, location: `character ${start + 1}`, preview: `${value.slice(0, 3)}••••${value.slice(-2)}`, start, end: start + value.length, value });
    }
  }
  const unique = new Map<string, SecretFinding>();
  findings.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  for (const finding of findings) {
    const key = `${finding.start}:${finding.end}`;
    if (!unique.has(key)) unique.set(key, finding);
  }
  return [...unique.values()];
}
export function redactSecrets(text: string, findings: SecretFinding[] = scanSecrets(text)): string {
  let output = text;
  for (const finding of [...findings].sort((a, b) => b.start - a.start)) {
    output = output.slice(0, finding.start) + '[REDACTED]' + output.slice(finding.end);
  }
  return output;
}
export function redactJsonText(text: string): { text: string; findings: SecretFinding[]; validJson: boolean } {
  const findings = scanSecrets(text);
  const redacted = redactSecrets(text, findings);
  try { JSON.parse(redacted); return { text: redacted, findings, validJson: true }; }
  catch {
    try {
      const parsed: unknown = JSON.parse(text);
      const sanitized = JSON.stringify(redactDeep(parsed), null, 2);
      return { text: sanitized, findings, validJson: true };
    } catch { return { text: redacted, findings, validJson: false }; }
  }
}
function redactDeep(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, /secret|password|token|api.?key|credential/i.test(key) && typeof v === 'string' ? '[REDACTED]' : redactDeep(v)]));
  return value;
}
