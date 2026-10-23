import type { ServerPreset, TestManifest } from '../types/manifest';

const rpc = (id: string | number, method: string, params?: Record<string, unknown>) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

export const PRESETS: Record<Exclude<ServerPreset, 'custom'>, TestManifest> = {
  filesystem: {
    id: 'fs-suite-v1', name: 'Filesystem MCP · Safe fixtures', description: 'Validate filesystem-style tools with local, non-destructive mock fixtures.', serverType: 'filesystem', protocolVersion: '2024-11-05',
    capabilities: ['tools'],
    tools: [
      { name: 'list_allowed_directories', description: 'List configured fixture directories.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, samples: [{ args: {}, expectedValid: true }] },
      { name: 'read_file', description: 'Read a file from the mock fixture set.', inputSchema: { type: 'object', properties: { path: { type: 'string', minLength: 1 } }, required: ['path'], additionalProperties: false }, samples: [{ args: { path: '/workspace/README.md' }, expectedValid: true }, { args: {}, expectedValid: false, label: 'Missing path should fail' }] },
      { name: 'search_files', description: 'Search fixture text for a query.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1 }, root: { type: 'string' } }, required: ['query'], additionalProperties: false }, samples: [{ args: { query: 'TODO' }, expectedValid: true }] },
    ],
    frames: [
      { name: 'Initialize handshake', request: rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-suite-local', version: '1.0.0' } }), expected: { protocolVersion: '2024-11-05' } },
      { name: 'Initialized notification', request: { jsonrpc: '2.0', method: 'notifications/initialized' }, capability: 'tools' },
      { name: 'Discover tools', request: rpc(2, 'tools/list'), expected: { containsTools: true }, capability: 'tools' },
      { name: 'Call read_file', request: rpc(3, 'tools/call', { name: 'read_file', arguments: { path: '/workspace/README.md' } }), expected: { isToolResult: true }, capability: 'tools' },
      { name: 'Invalid method error example', request: rpc(4, 'method/does-not-exist'), expectedError: { code: -32601, message: 'Method not found' } },
    ],
  },
  'brave-search': {
    id: 'brave-suite-v1', name: 'Brave Search MCP · Search fixtures', description: 'Exercise search tool argument schemas without an API key or network request.', serverType: 'brave-search', protocolVersion: '2024-11-05', capabilities: ['tools'],
    tools: [
      { name: 'brave_web_search', description: 'Search web results from a mock response.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1 }, count: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['query'], additionalProperties: false }, samples: [{ args: { query: 'Model Context Protocol', count: 5 }, expectedValid: true }, { args: { query: '', count: 100 }, expectedValid: false, label: 'Empty query and excessive count' }] },
      { name: 'brave_local_search', description: 'Search local business fixtures.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1 }, country: { type: 'string', minLength: 2, maxLength: 2 } }, required: ['query'], additionalProperties: false }, samples: [{ args: { query: 'coffee', country: 'US' }, expectedValid: true }] },
    ],
    frames: [
      { name: 'Initialize handshake', request: rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-suite-local', version: '1.0.0' } }), expected: { protocolVersion: '2024-11-05' } },
      { name: 'Discover search tools', request: rpc(2, 'tools/list'), expected: { containsTools: true }, capability: 'tools' },
      { name: 'Search with valid arguments', request: rpc(3, 'tools/call', { name: 'brave_web_search', arguments: { query: 'MCP protocol', count: 5 } }), expected: { isToolResult: true }, capability: 'tools' },
      { name: 'Method not found example', request: rpc(4, 'invalid/method'), expectedError: { code: -32601, message: 'Method not found' } },
    ],
  },
  'knowledge-graph': {
    id: 'kg-suite-v1', name: 'Knowledge Graph Memory · Entity fixtures', description: 'Check memory-style entity and relation schemas using mock data only.', serverType: 'knowledge-graph', protocolVersion: '2024-11-05', capabilities: ['tools'],
    tools: [
      { name: 'create_entities', description: 'Create named entity fixtures.', inputSchema: { type: 'object', properties: { entities: { type: 'array', minItems: 1, items: { type: 'object', properties: { name: { type: 'string', minLength: 1 }, entityType: { type: 'string' }, observations: { type: 'array', items: { type: 'string' } } }, required: ['name', 'entityType'], additionalProperties: false } } }, required: ['entities'], additionalProperties: false }, samples: [{ args: { entities: [{ name: 'MCP', entityType: 'Protocol', observations: ['Uses JSON-RPC'] }] }, expectedValid: true }, { args: { entities: [] }, expectedValid: false }] },
      { name: 'search_nodes', description: 'Find mock entities by query.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1 } }, required: ['query'], additionalProperties: false }, samples: [{ args: { query: 'protocol' }, expectedValid: true }] },
      { name: 'open_nodes', description: 'Open known entities by names.', inputSchema: { type: 'object', properties: { names: { type: 'array', minItems: 1, items: { type: 'string' } } }, required: ['names'], additionalProperties: false }, samples: [{ args: { names: ['MCP'] }, expectedValid: true }] },
    ],
    frames: [
      { name: 'Initialize handshake', request: rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-suite-local', version: '1.0.0' } }), expected: { protocolVersion: '2024-11-05' } },
      { name: 'Discover entity tools', request: rpc(2, 'tools/list'), expected: { containsTools: true }, capability: 'tools' },
      { name: 'Create sample entity', request: rpc(3, 'tools/call', { name: 'create_entities', arguments: { entities: [{ name: 'MCP', entityType: 'Protocol' }] } }), expected: { isToolResult: true }, capability: 'tools' },
      { name: 'Malformed request example', request: { id: 6, method: 'tools/list' }, expectedError: { code: -32600, message: 'Invalid Request' } },
    ],
  },
  postgresql: {
    id: 'pg-suite-v1', name: 'PostgreSQL MCP · Query fixtures', description: 'Validate database-tool input shape without connecting to a database.', serverType: 'postgresql', protocolVersion: '2024-11-05', capabilities: ['tools'],
    tools: [
      { name: 'query', description: 'Execute a read-only mock SQL query.', inputSchema: { type: 'object', properties: { sql: { type: 'string', minLength: 1 }, params: { type: 'array', items: {} } }, required: ['sql'], additionalProperties: false }, samples: [{ args: { sql: 'SELECT 1 AS ok', params: [] }, expectedValid: true }, { args: { sql: '' }, expectedValid: false }] },
      { name: 'list_tables', description: 'List tables from mock schema metadata.', inputSchema: { type: 'object', properties: { schema: { type: 'string' } }, additionalProperties: false }, samples: [{ args: { schema: 'public' }, expectedValid: true }] },
    ],
    frames: [
      { name: 'Initialize handshake', request: rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-suite-local', version: '1.0.0' } }), expected: { protocolVersion: '2024-11-05' } },
      { name: 'Discover database tools', request: rpc(2, 'tools/list'), expected: { containsTools: true }, capability: 'tools' },
      { name: 'Run harmless SELECT fixture', request: rpc(3, 'tools/call', { name: 'query', arguments: { sql: 'SELECT 1 AS ok' } }), expected: { isToolResult: true }, capability: 'tools' },
      { name: 'Malformed JSON-RPC request', request: { jsonrpc: '1.0', id: 4, method: 'tools/list' }, expectedError: { code: -32600, message: 'Invalid Request' } },
    ],
  },
};

export const PRESET_OPTIONS: Array<{ id: ServerPreset; label: string; short: string }> = [
  { id: 'filesystem', label: 'Filesystem', short: 'FILE' },
  { id: 'brave-search', label: 'Brave Search', short: 'WEB' },
  { id: 'knowledge-graph', label: 'Knowledge Graph', short: 'MEM' },
  { id: 'postgresql', label: 'PostgreSQL', short: 'SQL' },
  { id: 'custom', label: 'Custom manifest', short: 'DIY' },
];

export function getPreset(id: ServerPreset): TestManifest {
  if (id === 'custom') return {
    id: 'custom-suite-v1', name: 'Custom MCP Test Suite', description: 'Paste or author your own MCP protocol test manifest.', serverType: 'custom', protocolVersion: '2024-11-05', capabilities: [], tools: [], frames: [],
  };
  return structuredClone(PRESETS[id]);
}
