import { describe, expect, it } from 'vitest';
import { getPreset } from '../src/data/presets';
import { validateManifestText } from '../src/engine/manifestValidator';
import { validateJsonRpc } from '../src/engine/jsonRpcValidator';
import { validateToolArgs, runToolSamples } from '../src/engine/schemaValidator';
import { scanSecrets, redactJsonText } from '../src/engine/secretScanner';
import { runBenchmark } from '../src/engine/benchmark';
import { runAssertions } from '../src/engine/mcpAssertions';
import { generatePythonTests, generateTypeScriptTests } from '../src/engine/codeGenerator';

describe('MCP manifest presets', () => {
  it('every bundled preset has a valid manifest', () => {
    for (const preset of ['filesystem', 'brave-search', 'knowledge-graph', 'postgresql', 'custom'] as const) {
      expect(validateManifestText(JSON.stringify(getPreset(preset))).valid).toBe(true);
    }
  });
  it('rejects invalid JSON and reports a helpful message', () => {
    const result = validateManifestText('{"id": }');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toBeTruthy();
  });
  it('rejects missing required manifest fields', () => {
    expect(validateManifestText('{"name":"oops"}').valid).toBe(false);
  });
});

describe('JSON-RPC validator', () => {
  it('accepts request, notification, success response, and error response', () => {
    expect(validateJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).valid).toBe(true);
    expect(validateJsonRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }).kind).toBe('notification');
    expect(validateJsonRpc({ jsonrpc: '2.0', id: 1, result: {} }).valid).toBe(true);
    expect(validateJsonRpc({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }).valid).toBe(true);
  });
  it('rejects wrong version, response missing result, and malformed errors', () => {
    expect(validateJsonRpc({ jsonrpc: '1.0', id: 1, method: 'foo' }).valid).toBe(false);
    expect(validateJsonRpc({ jsonrpc: '2.0', id: 1 }).valid).toBe(false);
    expect(validateJsonRpc({ jsonrpc: '2.0', id: 1, error: { code: 'bad' } }).valid).toBe(false);
  });
});

describe('tool JSON Schema validation', () => {
  it('validates required fields and constraints', () => {
    const tool = getPreset('filesystem').tools.find(t => t.name === 'read_file')!;
    expect(validateToolArgs(tool, { path: '/tmp/a' }).valid).toBe(true);
    expect(validateToolArgs(tool, {}).valid).toBe(false);
    expect(validateToolArgs(tool, { path: 'a', extra: true }).valid).toBe(false);
  });
  it('checks expected-valid and expected-invalid samples', () => {
    expect(runToolSamples(getPreset('brave-search').tools).every(sample => sample.passed)).toBe(true);
  });
});

describe('secret scan and redaction', () => {
  it('detects common key patterns without showing the whole secret in previews', () => {
    const token = 'ghp_12345678901234567890123456789012';
    const found = scanSecrets(`{"token":"${token}"}`);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].preview).not.toContain(token);
  });
  it('redacts secrets while preserving JSON structure for JSON values', () => {
    const clean = redactJsonText(JSON.stringify({ api_key: 'super-secret-123456', ok: true }));
    expect(clean.findings.length).toBeGreaterThan(0);
    expect(JSON.parse(clean.text)).toEqual({ api_key: '[REDACTED]', ok: true });
  });
});

describe('benchmark runner', () => {
  it('produces deterministic statistics with a controlled clock', async () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7]; let index = 0;
    const result = await runBenchmark({ iterations: 3, warmups: 0, thresholdMs: 2, payload: 'hi' }, () => undefined, () => values[index++]!);
    expect(result.samples).toEqual([1, 1, 1]);
    expect(result.average).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.payloadBytes).toBe(2);
  });
});

describe('assertion engine and code exporters', () => {
  it('runs actual logic and finds a declared schema mismatch', () => {
    const manifest = getPreset('filesystem');
    manifest.frames.push({ name: 'bad call', request: { jsonrpc: '2.0', id: 999, method: 'tools/call', params: { name: 'read_file', arguments: {} } } });
    const results = runAssertions(manifest, JSON.stringify(manifest));
    expect(results.some(r => r.name === 'Tool Execution (tools/call)' && r.status === 'FAIL')).toBe(true);
  });
  it('exports test code based on selected manifest name and tools', () => {
    const manifest = getPreset('brave-search');
    expect(generateTypeScriptTests(manifest)).toContain('brave_web_search');
    expect(generatePythonTests(manifest)).toContain('brave_web_search');
  });
});
