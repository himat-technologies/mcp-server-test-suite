import type { TestManifest } from '../types/manifest';
const safeJson = (manifest: TestManifest) => JSON.stringify(manifest, null, 2);
export function generateTypeScriptTests(manifest: TestManifest): string {
  return `/** Generated from a local MCP test manifest. These tests use mock fixtures. */
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
const manifest = ${safeJson(manifest)} as const;
const ajv = new Ajv({ allErrors: true, strict: false });
describe(manifest.name, () => {
  it('contains required manifest fields', () => {
    expect(manifest.id).toBeTruthy(); expect(manifest.name).toBeTruthy();
    expect(manifest.protocolVersion).toBeTruthy(); expect(Array.isArray(manifest.tools)).toBe(true);
    expect(Array.isArray(manifest.frames)).toBe(true);
  });
  it('uses JSON-RPC 2.0 request frames', () => {
    for (const frame of manifest.frames) {
      expect(frame.request.jsonrpc).toBe('2.0'); expect(typeof frame.request.method).toBe('string');
      if (frame.request.method !== 'notifications/initialized') expect(frame.request).toHaveProperty('id');
    }
  });
  it('declares unique tool names and valid schemas', () => {
    const names = manifest.tools.map(tool => tool.name); expect(new Set(names).size).toBe(names.length);
    for (const tool of manifest.tools) expect(ajv.validateSchema(tool.inputSchema)).toBe(true);
  });
  it('validates manifest-specific argument samples', () => {
    for (const tool of manifest.tools) { const validate = ajv.compile(tool.inputSchema);
      for (const sample of tool.samples ?? []) expect(Boolean(validate(sample.args)), tool.name + ': ' + (sample.label ?? 'sample')).toBe(sample.expectedValid);
    }
  });
});
`;
}
export function generatePythonTests(manifest: TestManifest): string {
  const json = JSON.stringify(manifest, null, 2);
  return `"""Generated manifest tests; mock-only, no live MCP transport."""
import json
from jsonschema import Draft7Validator
MANIFEST = json.loads(${JSON.stringify(json)})

def test_required_manifest_fields():
    for field in ('id','name','description','serverType','protocolVersion','capabilities','tools','frames'):
        assert field in MANIFEST, f'missing field: {field}'

def test_json_rpc_request_fixtures():
    for frame in MANIFEST['frames']:
        request = frame['request']
        assert request.get('jsonrpc') == '2.0', frame['name']
        assert isinstance(request.get('method'), str), frame['name']
        if request.get('method') != 'notifications/initialized': assert 'id' in request

def test_tool_schemas_and_samples():
    names = [t['name'] for t in MANIFEST['tools']]
    assert len(names) == len(set(names))
    for tool in MANIFEST['tools']:
        Draft7Validator.check_schema(tool['inputSchema'])
        validator = Draft7Validator(tool['inputSchema'])
        for sample in tool.get('samples', []):
            assert validator.is_valid(sample['args']) is sample['expectedValid'], f"{tool['name']}: {sample.get('label','sample')}"
`;
}
export function generateGithubWorkflow(): string {
  return `name: MCP manifest checks\non:\n  push:\n  pull_request:\n  workflow_dispatch:\njobs:\n  manifest-tests:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm ci\n      - name: Run test suite\n        run: npm test\n      - name: Production build\n        run: npm run build\n`;
}
export function generatedReadme(manifest: TestManifest): string {
  return `# Generated MCP tests — ${manifest.name}\n\nGenerated from the **${manifest.name}** manifest by [MCP Server Test Suite](https://himat.tech/free-tools/mcp-server-test-suite).\n\n**Safety:** These are local fixture and schema checks. They do not connect to a real server. Add official MCP SDK transport tests separately for an authorized target.\n\n## TypeScript\n\n\`\`\`bash\nnpm install --save-dev vitest ajv\nnpx vitest run\n\`\`\`\n\n## Python\n\n\`\`\`bash\npython -m pip install pytest jsonschema\npython -m pytest\n\`\`\`\n`;
}
