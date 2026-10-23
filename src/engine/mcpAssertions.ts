import type { AssertionResult, TestManifest } from '../types/manifest';
import { validateJsonRpc, assertExpectedError } from './jsonRpcValidator';
import { validateManifest } from './manifestValidator';
import { runToolSamples, validateToolArgs } from './schemaValidator';
import { scanSecrets } from './secretScanner';

export function runAssertions(manifest: TestManifest, rawText = JSON.stringify(manifest), now: () => number = () => performance.now()): AssertionResult[] {
  const results: AssertionResult[] = [];
  const add = (name: string, status: AssertionResult['status'], explanation: string, expected: string, actual: string, category: string, request?: unknown, response?: unknown, durationMs = 0) => {
    results.push({ id: `${results.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, status, explanation, expected, actual, category, ...(request === undefined ? {} : { request }), ...(response === undefined ? {} : { response }), durationMs });
  };
  const manifestResult = validateManifest(manifest);
  add('Test Suite Manifest Structure', manifestResult.valid ? 'PASS' : 'FAIL', manifestResult.valid ? 'Required manifest fields and data types are valid.' : manifestResult.errors.map(e => `${e.path} ${e.message}`).join('; '), 'Required fields with valid types', manifestResult.valid ? 'Manifest is valid' : manifestResult.errors.map(e => e.message).join('; '), 'manifest', manifest);

  const init = manifest.frames.find((f) => f.request.method === 'initialize');
  if (init) {
    const rpc = validateJsonRpc(init.request);
    add('MCP Initialize Handshake', rpc.valid && rpc.kind === 'request' ? 'PASS' : 'FAIL', rpc.valid ? 'Initialize frame is a valid JSON-RPC request.' : rpc.errors.join('; '), 'Valid JSON-RPC initialize request with id', rpc.kind, 'protocol', init.request);
    const params = init.request.params as Record<string, unknown> | undefined;
    const handshakeValid = typeof params?.protocolVersion === 'string' && typeof params?.clientInfo === 'object' && params?.clientInfo !== null && typeof params?.capabilities === 'object' && params?.capabilities !== null;
    add('Initialize parameters', handshakeValid ? 'PASS' : 'FAIL', handshakeValid ? 'Initialize includes protocolVersion, clientInfo, and capabilities.' : 'Initialize parameters are incomplete.', 'protocolVersion, clientInfo, capabilities', JSON.stringify(params ?? {}), 'protocol', init.request);
  } else add('MCP Initialize Handshake', 'FAIL', 'No initialize frame was found.', 'At least one initialize request', 'Missing initialize request', 'protocol');

  const initialized = manifest.frames.find((f) => f.request.method === 'notifications/initialized');
  if (initialized) {
    const rpc = validateJsonRpc(initialized.request);
    add('Initialization Notification', rpc.valid && rpc.kind === 'notification' ? 'PASS' : 'FAIL', rpc.valid ? 'Notification correctly omits the request id.' : rpc.errors.join('; '), 'JSON-RPC notification without id', rpc.kind, 'protocol', initialized.request);
  } else add('Initialization Notification', 'SKIPPED', 'No initialized notification sample is defined.', 'Optional notification frame', 'Not present in manifest', 'protocol');

  const toolsFrame = manifest.frames.find((f) => f.request.method === 'tools/list');
  const hasToolsCapability = manifest.capabilities.includes('tools');
  if (!hasToolsCapability) add('Tool Discovery (tools/list)', 'SKIPPED', 'Manifest does not advertise tools capability.', 'tools capability if tool checks are required', 'Capability not configured', 'tools');
  else if (toolsFrame) {
    const rpc = validateJsonRpc(toolsFrame.request);
    add('Tool Discovery (tools/list)', rpc.valid ? 'PASS' : 'FAIL', rpc.valid ? `Valid tools/list request; ${manifest.tools.length} tool definition(s) available in manifest.` : rpc.errors.join('; '), 'Valid JSON-RPC request and tool definitions', `${manifest.tools.length} local tool definitions`, 'tools', toolsFrame.request);
  } else add('Tool Discovery (tools/list)', 'FAIL', 'tools capability is present but no tools/list frame is configured.', 'A tools/list frame', 'Missing frame', 'tools');

  const toolNames = new Set<string>();
  let toolsValid = true;
  manifest.tools.forEach((tool) => {
    if (!tool.name.trim() || toolNames.has(tool.name) || !tool.inputSchema || typeof tool.inputSchema !== 'object') toolsValid = false;
    toolNames.add(tool.name);
  });
  add('Tool Definition & Schema Validation', toolsValid ? 'PASS' : 'FAIL', toolsValid ? 'Tool names are non-empty and unique; schemas are objects.' : 'At least one tool name is blank or duplicated, or its schema is invalid.', 'Unique tool names and schema objects', `${manifest.tools.length} tool(s) validated`, 'tools', manifest.tools);

  const sampleResults = runToolSamples(manifest.tools);
  if (sampleResults.length) {
    const failing = sampleResults.filter((s) => !s.passed);
    add('Tool Input Schema Validation', failing.length === 0 ? 'PASS' : 'FAIL', failing.length === 0 ? `${sampleResults.length} sample argument case(s) matched their expected validity.` : `${failing.length} sample case(s) did not match expected validity: ${failing.map(f => `${f.tool}/${f.label}`).join(', ')}`, 'Samples pass or fail according to JSON Schema', `${sampleResults.length - failing.length} passed; ${failing.length} failed`, 'tools', sampleResults);
  } else add('Tool Input Schema Validation', 'SKIPPED', 'No tool argument samples were supplied.', 'Optional argument samples', 'No samples in manifest', 'tools');

  const callFrames = manifest.frames.filter(f => f.request.method === 'tools/call');
  if (!hasToolsCapability) add('Tool Execution (tools/call)', 'SKIPPED', 'Manifest does not advertise tools capability.', 'tools capability', 'Not applicable', 'tools');
  else if (!callFrames.length) add('Tool Execution (tools/call)', 'SKIPPED', 'No tool-call frame was configured.', 'Optional tools/call fixture', 'Not present', 'tools');
  else {
    const errors = callFrames.flatMap((f) => {
      const p = f.request.params as Record<string, unknown> | undefined;
      if (typeof p?.name !== 'string') return [`${f.name}: params.name is required`];
      const tool = manifest.tools.find(t => t.name === p.name);
      if (!tool) return [`${f.name}: tool ${p.name} not declared in manifest`];
      return validateToolArgs(tool, p.arguments ?? {}).errors.map(e => `${f.name}: ${e}`);
    });
    add('Tool Execution (tools/call)', errors.length === 0 ? 'PASS' : 'FAIL', errors.length ? errors.join('; ') : `${callFrames.length} tool-call fixture(s) refer to declared tools and satisfy their input schemas.`, 'Declared tools with schema-valid arguments', errors.length ? errors.join('; ') : 'Tool calls validated locally', 'tools', callFrames);
  }

  const resourceRequested = manifest.frames.some(f => typeof f.request.method === 'string' && /^(resources\/list|resources\/read)$/.test(f.request.method));
  const promptRequested = manifest.frames.some(f => f.request.method === 'prompts/list');
  add('Resources Discovery & Reading', resourceRequested ? 'PASS' : 'SKIPPED', resourceRequested ? 'Resource request fixture(s) are present and JSON-RPC validated below.' : 'This manifest does not include resource fixtures.', 'Resources/list or resources/read frame if supported', resourceRequested ? 'Resource fixture found' : 'Not configured', 'capability');
  add('Prompts Discovery', promptRequested ? 'PASS' : 'SKIPPED', promptRequested ? 'Prompts/list frame is present.' : 'This manifest does not include prompts/list.', 'prompts/list frame if supported', promptRequested ? 'Prompt fixture found' : 'Not configured', 'capability');

  const rpcRequests = manifest.frames.filter(f => f.request.method !== 'initialize' && f.request.method !== 'notifications/initialized');
  const started = now();
  const malformed = rpcRequests.map(frame => ({ frame, result: validateJsonRpc(frame.request) }));
  const badCount = malformed.filter(x => !x.result.valid).length;
  add('JSON-RPC 2.0 Message Structure', badCount === 0 ? 'PASS' : 'FAIL', badCount ? `${badCount} request frame(s) have invalid JSON-RPC structure.` : `${rpcRequests.length} configured request frame(s) have valid JSON-RPC 2.0 structure.`, 'jsonrpc="2.0", method and applicable id types', badCount ? malformed.filter(x => !x.result.valid).map(x => `${x.frame.name}: ${x.result.errors.join(', ')}`).join('; ') : 'All configured request frames valid', 'jsonrpc', rpcRequests, undefined, Math.max(0, now() - started));

  const expectedErrorFrames = manifest.frames.filter(f => f.expectedError);
  if (expectedErrorFrames.length) {
    const expectedChecks = expectedErrorFrames.map(f => {
      const params = f.request.params as Record<string, unknown> | undefined;
      const simulated = params?.mockResponse ?? params?.responseFixture;
      return assertExpectedError(simulated, f.expectedError);
    });
    const passed = expectedChecks.every(c => c.valid);
    add('Standard JSON-RPC & MCP Error Handling', passed ? 'PASS' : 'FAIL', passed ? 'Supplied error response fixtures match their declared codes and messages.' : expectedChecks.map(c => c.detail).join('; '), 'Actual error response fixture with expected code and message', `${expectedChecks.filter(c => c.valid).length}/${expectedChecks.length} fixture(s) match`, 'jsonrpc', expectedErrorFrames);
  } else add('Standard JSON-RPC & MCP Error Handling', 'SKIPPED', 'No expected-error fixtures are declared.', 'Optional expected-error fixture', 'Not configured', 'jsonrpc');

  const findings = scanSecrets(rawText);
  add('Secret & Credential Exposure Scan', findings.length ? 'FAIL' : 'PASS', findings.length ? `${findings.length} possible credential pattern(s) found. Review and redact before sharing.` : 'No supported credential patterns were detected.', 'No likely secrets in manifest', findings.length ? findings.map(f => `${f.kind} at ${f.location} (${f.severity})`).join('; ') : 'No findings', 'security');
  add('Mock Runner Safety', 'PASS', 'Only deterministic local fixtures are evaluated; no external MCP server is contacted by this run.', 'Clearly labelled local/mock execution', 'Mock execution mode', 'safety');
  return results;
}

export function summarizeResults(results: AssertionResult[], durationMs: number, preset: string, suiteName: string): import('../types/manifest').RunReport {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  return { id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toISOString(), preset, suiteName, total: results.length, passed, failed, skipped, durationMs, mode: 'mock', results };
}
